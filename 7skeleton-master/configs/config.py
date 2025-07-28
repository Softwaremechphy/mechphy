from pydantic import BaseSettings

class Settings(BaseSettings):
    KAFKA_BROKER: str = 'kafka://localhost:9092'
    KAFKA_TOPIC: str = 'soldiers-data'
    KAFKA_KILLFEED_TOPIC: str = 'killfeed'
    MONGODB_URI: str = 'mongodb://0.0.0.0:27017'
    DB_out: str = 'outside_monitoring'
    DB_in: str = 'archival_monitoring'
    DB_real: str = 'realtime_monitoring'
    INCOMING_SOLDIER_COLLECTION: str = 'Incoming_Soldiers'
    GEO_COLLECTION: str = 'GeoData'
    SOLDIER_COLLECTION: str = 'soldiers'
    WEAPONS_COLLECTION: str = 'weapons'
    VEST_COLLECTION: str = 'vests'
    EXPLOSIVE_COLLECTION: str = 'Explosives'
    VEHICLE_COLLECTION: str = 'Vehicle'
    FASTAPI_HOST: str = '0.0.0.0'
    FASTAPI_PORT: int = 8000
    SERIAL_PORT: str = '/dev/ttyUSB0'
    SERIAL_BAUDRATE: int = 9600
    WS_HOST: str = '0.0.0.0'
    WS_PORT: int = 8001
    KILL_FEED_WS_PORT: int = 8002
    
    class Config:
        env_file = ".env"  # Optional: Load environment variables from .env file

# Instantiate settings
settings = Settings()

# Access your configuration
print(settings.KAFKA_BROKER)
print(settings.FASTAPI_PORT)
