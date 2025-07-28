import asyncio
import subprocess
from backend_logic.backendConnection.faust_app_v1 import app as soldier_topic
from backend_logic.data_ingestion.serial_receiver import receive_serial_data
import sys

async def send_to_kafka():
    """Send received soldier data to Kafka topic."""
    async for soldier_data in receive_serial_data():
        if soldier_data:
            await soldier_topic.send(value=soldier_data, channel="soldiers")

# async def run_faust():
#     """Run the Faust worker as a subprocess."""
#     faust_process = subprocess.Popen(["faust", "-A", "backend_logic.backendConnection.faust_app_v1", "worker", "--loglevel=info"])
#     return faust_process

async def run_faust():
    """Run the Faust worker as a subprocess."""
    process = await asyncio.create_subprocess_exec(
        "faust", "-A", "backend_logic.backendConnection.faust_app_v1", "worker", "--loglevel=info"
    )
    return process


async def run_fastapi():
    """Run the FastAPI server."""
    import uvicorn
    from backend_logic.backendConnection.fastapi_app import app  # Import your FastAPI app here

    config = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="debug")
    server = uvicorn.Server(config)
    await server.serve()

async def main():
    # Start the Faust worker
    faust_process = await run_faust()
    
    print("after faust process")

    # Start the FastAPI server
    fastapi_task = asyncio.create_task(run_fastapi())
    print("after fastapi")
    # Start sending data to Kafka
    try:
        await send_to_kafka()
        print("sending to kafka")
    except Exception as e:
        print(f"Error during data processing: {e}")
    finally:
        faust_process.terminate()
        faust_process.wait()  # Ensure it finishes cleanly

if __name__ == "__main__":
    # Create a separate asyncio event loop for data ingestion
    loop = asyncio.get_event_loop()

    try:
        loop.run_until_complete(main())
    finally:
        loop.close()
        sys.exit(1)