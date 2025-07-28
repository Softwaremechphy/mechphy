# debug.data_source.py
import asyncio
import logging
from backend_logic.data_ingestion.serial_receiver import receive_serial_data
from backend_logic.backendConnection.faust_app_v1 import app as faust_app
from configs.config import settings

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def debug_serial_data():
    """Test if serial receiver is actually producing data"""
    logger.info("=== Testing Serial Data Reception ===")
    logger.info(f"Serial port should be: /dev/ttyUSB0")
    
    try:
        count = 0
        async for data in receive_serial_data():        
            count += 1
            logger.info(f"SERIAL DATA #{count}: {data}")
            if count >= 5:  # Only test first 5 messages
                break
    except Exception as e:
        logger.error(f"Serial data error: {e}")
        logger.info("This is expected if no serial device is connected.")

async def debug_kafka_consumer():
    """Test if Kafka topic has existing data"""
    logger.info("=== Testing Kafka Topic Content ===")
    
    # Import the soldier topic
    from backend_logic.backendConnection.faust_app_v1 import soldier_topic
    
    try:
        count = 0
        async for message in soldier_topic.stream():
            count += 1
            logger.info(f"KAFKA MESSAGE #{count}: {message}")
            if count >= 5:  # Only test first 5 messages
                break
            await asyncio.sleep(0.1)
    except Exception as e:
        logger.error(f"Kafka consumer error: {e}")

async def check_kafka_topic_info():
    """Check Kafka topic information using command line tools"""
    logger.info("=== Kafka Topic Information ===")
    logger.info(f"Kafka Broker: {settings.KAFKA_BROKER}")
    logger.info(f"Kafka Topic: {settings.KAFKA_TOPIC}")
    
    # Use subprocess to run Kafka command line tools
    try:
        import subprocess
        
        logger.info("Checking topic details...")
        result = subprocess.run([
            'kafka-topics.sh', '--describe', 
            '--topic', settings.KAFKA_TOPIC,
            '--bootstrap-server', settings.KAFKA_BROKER
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            logger.info(f"Topic details:\n{result.stdout}")
        else:
            logger.error(f"Error describing topic: {result.stderr}")
            
        # Check for existing messages using console consumer
        logger.info("Checking for existing messages (timeout 3 seconds)...")
        result = subprocess.run([
            'kafka-console-consumer.sh',
            '--topic', settings.KAFKA_TOPIC,
            '--bootstrap-server', settings.KAFKA_BROKER,
            '--from-beginning',
            '--timeout-ms', '3000'
        ], capture_output=True, text=True, timeout=5)
        
        if result.stdout.strip():
            logger.warning(f"Found existing messages in topic:\n{result.stdout}")
        else:
            logger.info("No existing messages found in topic")
            
    except subprocess.TimeoutExpired:
        logger.info("Kafka command timed out - this is normal if topic is empty")
    except FileNotFoundError:
        logger.warning("Kafka command line tools not found in PATH")
    except Exception as e:
        logger.error(f"Error checking Kafka topic: {e}")

async def main():
    """Main debug function"""
    logger.info("Starting data source debugging...")
    
    # Test 1: Check if serial is producing data
    logger.info("\n" + "="*50)
    await debug_serial_data()
    
    # Test 2: Check Kafka topic info
    logger.info("\n" + "="*50)
    await check_kafka_topic_info()
    
    logger.info("\n" + "="*50)
    logger.info("Debug complete!")

if __name__ == "__main__":
    asyncio.run(main())