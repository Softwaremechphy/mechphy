# #main.py
# import asyncio
# import sys
# from contextlib import asynccontextmanager
# from backend_logic.backendConnection.faust_app_v1 import app as soldier_topic
# from backend_logic.data_ingestion.serial_receiver import receive_serial_data
# from backend_logic.backendConnection.fastapi_app import app as fastapi_app
# from backend_logic.backendConnection.replay_app import create_replay_app
# import uvicorn
# from fastapi import FastAPI

# # Global variable to store the replay app instance
# replay_app = None

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     """Handle startup and shutdown events for FastAPI"""
#     global replay_app
    
#     if app.state.mode == "replay":
#         # Initialize ReplayApp on startup
#         replay_app = create_replay_app()
#         await replay_app.start_websocket_services()
        
#     yield
    
#     # Cleanup on shutdown
#     if replay_app:
#         await replay_app.stop_websocket_services()
#         if replay_app.controller:
#             await replay_app.controller.stop()

# async def send_to_kafka():
#     """Send received soldier data to Kafka topic."""
#     async for soldier_data in receive_serial_data():
#         if soldier_data:
#             print(f"Sending soldier data to Kafka: {soldier_data}")
#             await soldier_topic.send(value=soldier_data, channel="soldiers")

# async def run_faust(faust_path, app_name):
#     """Run a Faust worker as a subprocess."""
#     process = await asyncio.create_subprocess_exec(
#         faust_path, "-A", app_name, "worker", "--loglevel=info"
#     )
#     return process

# async def run_fastapi(mode):
#     """Run the FastAPI server."""
#     # Set the mode in the FastAPI app state
#     fastapi_app.state.mode = mode
    
#     config = uvicorn.Config(
#         fastapi_app,
#         host="0.0.0.0",
#         port=8000,
#         log_level="info",
#         lifespan="on"
#     )
#     server = uvicorn.Server(config)
#     await server.serve()

# async def main(mode="realtime"):
#     """Main function to coordinate all services"""
#     try:
#         if mode == "realtime":
#             # Start Faust worker for real-time processing
#             faust_process = await run_faust("faust", "backend_logic.backendConnection.faust_app_v1")
            
#             # Run FastAPI and Kafka sender concurrently
#             await asyncio.gather(
#                 run_fastapi(mode),
#                 send_to_kafka(),
#                 return_exceptions=True
#             )
            
#             # Cleanup Faust process
#             if faust_process:
#                 faust_process.terminate()
#                 await faust_process.wait()
                
#         elif mode == "replay":
#             # In replay mode, just run FastAPI with WebSocket services
#             await run_fastapi(mode)
#         else:
#             print("Invalid mode. Use 'realtime' or 'replay'.")
#             sys.exit(1)
            
#     except Exception as e:
#         print(f"Error during {mode} mode processing: {str(e)}")
#         raise
#     finally:
#         # Ensure cleanup of any remaining resources
#         if mode == "replay" and replay_app:
#             await replay_app.stop_websocket_services()

# if __name__ == "__main__":
#     # Set mode based on command-line argument
#     mode = sys.argv[1] if len(sys.argv) > 1 else "realtime"
    
#     # Run the application
#     try:
#         asyncio.run(main(mode=mode))
#     except KeyboardInterrupt:
#         print("\nShutting down gracefully...")
#     except Exception as e:
#         print(f"Fatal error: {str(e)}")
#         sys.exit(1)


import asyncio
import sys
from contextlib import asynccontextmanager

# from backend_logic.backendConnection.faust_app_v1 import app as soldier_topic (commented after 2/10/2025)
from backend_logic.backendConnection.faust_app_v1 import soldier_topic


from backend_logic.data_ingestion.serial_receiver import receive_serial_data
from backend_logic.backendConnection.fastapi_app import app as fastapi_app
from backend_logic.backendConnection.replay_app import create_replay_app
import uvicorn
from fastapi import FastAPI
import logging
import subprocess

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Global variable to store the replay app instance
replay_app = None


realtime_state = {
    "faust_process": None,
    "send_task": None,
}

async def start_realtime_services(session_id):
    """Start Faust worker and serial ingestion."""
    if realtime_state["faust_process"] is None:
        # Start Faust worker
        realtime_state["faust_process"] = await run_faust("faust", "backend_logic.backendConnection.faust_app_v1")
    if realtime_state["send_task"] is None:
        # Start serial ingestion and Kafka sender
        realtime_state["send_task"] = asyncio.create_task(send_to_kafka())
    logger.info("Real-time services started.")

async def stop_realtime_services():
    """Stop Faust worker and serial ingestion."""
    # Stop serial ingestion
    send_task = realtime_state.get("send_task")
    if send_task:
        send_task.cancel()
        try:
            await send_task
        except asyncio.CancelledError:
            pass
        realtime_state["send_task"] = None

    # Stop Faust worker
    faust_process = realtime_state.get("faust_process")
    if faust_process:
        faust_process.terminate()
        await faust_process.wait()
        realtime_state["faust_process"] = None

    # Set the flag to stop loops
    from backend_logic.backendConnection.faust_app_v1 import app
    app.should_stop_realtime = True

    logger.info("Real-time services stopped.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events for FastAPI"""
    global replay_app
    
    if app.state.mode == "replay":
        # Initialize ReplayApp on startup
        replay_app = create_replay_app()
        await replay_app.start_websocket_services()
        
    yield
    
    # Cleanup on shutdown
    if replay_app:
        await replay_app.stop_websocket_services()
        if replay_app.controller:
            await replay_app.controller.stop()

async def send_to_kafka():
    """Send received soldier data to Kafka topic."""
    try:    
        async for soldier_data in receive_serial_data():
            logger.debug(f"Received soldier_data for Kafka: {soldier_data}")
            if soldier_data:
                logger.info(f"Sending to Kafka: {soldier_data}")
                # await soldier_topic.send(value=soldier_data, channel="soldiers")
                await soldier_topic.send(value=soldier_data)
            else:
                logger.warning("No valid soldier_data to send to Kafka")
    except asyncio.CancelledError:
        logger.info("send_to_kafka cancelled")
        raise
    except Exception as e:
        logger.error(f"Error in send_to_kafka: {e}")

async def run_faust(faust_path, app_name):
    """Run a Faust worker as a subprocess."""
    process = await asyncio.create_subprocess_exec(
        faust_path, "-A", app_name, "worker", "--loglevel=info"
    )
    return process

async def run_fastapi(mode):
    """Run the FastAPI server."""
    # Set the mode in the FastAPI app state
    fastapi_app.state.mode = mode
    
    config = uvicorn.Config(
        fastapi_app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        lifespan="on"
    )
    server = uvicorn.Server(config)
    await server.serve()

async def main(mode="realtime"):
    """Main function to coordinate all services"""
    try:
        if mode == "realtime":
            # Start Faust worker for real-time processing
            faust_process = await run_faust("faust", "backend_logic.backendConnection.faust_app_v1")
            
            # Run FastAPI and Kafka sender concurrently
            send_task = asyncio.create_task(send_to_kafka())
            fastapi_task = asyncio.create_task(run_fastapi(mode))
            try:
                await asyncio.gather(send_task, fastapi_task, return_exceptions=True)
            except asyncio.CancelledError:
                logger.info("Main tasks cancelled")
                send_task.cancel()
                fastapi_task.cancel()
            
            # Cleanup Faust process
            if faust_process:
                faust_process.terminate()
                await faust_process.wait()
                
        elif mode == "replay":
            # In replay mode, just run FastAPI with WebSocket services
            await run_fastapi(mode)
        else:
            logger.error("Invalid mode. Use 'realtime' or 'replay'.")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Error during {mode} mode processing: {str(e)}")
        raise
    finally:
        # Ensure cleanup of any remaining resources
        if mode == "replay" and replay_app:
            await replay_app.stop_websocket_services()

if __name__ == "__main__":
    # Set mode based on command-line argument
    mode = sys.argv[1] if len(sys.argv) > 1 else "realtime"
    
    # Run the application
    try:
        asyncio.run(main(mode=mode))
    except KeyboardInterrupt:
        logger.info("\nShutting down gracefully...")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)