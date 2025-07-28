# Main FastAPI application file that sets up the web server, routes, and WebSocket services

# Import FastAPI framework components
from fastapi import FastAPI, WebSocket  # FastAPI for web framework, WebSocket for real-time communication
from fastapi.middleware.cors import CORSMiddleware  # Handle Cross-Origin Resource Sharing
from configs.config import settings  # Import application configuration
from configs.logging_config import fastapi_logger, faust_logger  # Import configured loggers
import json  # For JSON serialization/deserialization
import asyncio  # For asynchronous operations

# Import route handlers (endpoints) for different resources
from backend_logic.routes_out.soldiers import router as soldier_dbOut_router  # Soldier data retrieval routes
from backend_logic.routes_out.weapons import router as weapon_dbOut_router   # Weapon data retrieval routes
from backend_logic.routes_out.vests import router as vest_dbOut_router      # Vest data retrieval routes
from backend_logic.routes_in.session import router as session_dbIn_router   # Session management routes

# Import replay functionality
from backend_logic.backendConnection.replay_app import create_replay_app, app as replay_app_instance  # Replay feature

def create_app():
    """
    Factory function to create and configure the FastAPI application instance.
    Returns: Configured FastAPI application
    """
    # Initialize the FastAPI application instance
    app = FastAPI()
    
    # Log the start of application initialization
    fastapi_logger.info("Initializing FastAPI application")
    
    # Configure CORS middleware to handle cross-origin requests
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],      # WARNING: In production, specify exact origins
        allow_credentials=True,    # Allow cookies in cross-origin requests
        allow_methods=["*"],      # Allow all HTTP methods (GET, POST, etc.)
        allow_headers=["*"],      # Allow all HTTP headers
    )
    fastapi_logger.debug("CORS middleware configured")
    
    try:
        # Register route handlers for different resources
        app.include_router(soldier_dbOut_router)  # Routes for soldier data retrieval
        app.include_router(weapon_dbOut_router)   # Routes for weapon data retrieval
        app.include_router(vest_dbOut_router)     # Routes for vest data retrieval
        app.include_router(session_dbIn_router)   # Routes for session management
        fastapi_logger.debug("Base routers included")
        
        # Mount the replay functionality under /api/replay
        app.include_router(
            replay_app_instance.api,
            prefix="/api/replay",  # All replay routes will be prefixed with /api/replay
            tags=["replay"]       # OpenAPI documentation tag
        )
        fastapi_logger.debug("Replay router included")
        
        # Register startup event handler
        @app.on_event("startup")
        async def startup_event():
            """Initialize WebSocket services when the application starts"""
            try:
                # Start all WebSocket services
                await replay_app_instance.ws_raw.start()      # Raw data WebSocket
                await replay_app_instance.ws_killfeed.start() # Kill feed WebSocket
                await replay_app_instance.ws_stats.start()    # Statistics WebSocket
                fastapi_logger.info("WebSocket services started successfully")
            except Exception as e:
                fastapi_logger.error(f"Failed to start WebSocket services: {str(e)}")
                raise
        
        # Register shutdown event handler
        @app.on_event("shutdown")
        async def shutdown_event():
            """Cleanup WebSocket services when the application shuts down"""
            try:
                # Stop all WebSocket services gracefully
                await replay_app_instance.ws_raw.stop()
                await replay_app_instance.ws_killfeed.stop()
                await replay_app_instance.ws_stats.stop()
                fastapi_logger.info("WebSocket services stopped successfully")
            except Exception as e:
                fastapi_logger.error(f"Failed to stop WebSocket services: {str(e)}")
    
    except Exception as e:
        # Log any errors during application initialization
        fastapi_logger.error(f"Failed to initialize application: {str(e)}")
        raise
    
    return app

# Create the global application instance
app = create_app()

# Entry point when running this file directly
if __name__ == "__main__":
    import uvicorn  # ASGI server implementation
    fastapi_logger.info("Starting FastAPI server")
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)