# import logging

# def setup_logger(name, log_file, level=logging.INFO):
#     """Function to setup as many loggers as you want"""
#     formatter = logging.Formatter(
#         fmt="{asctime} - {levelname} - {name} - {message}",
#         style="{",
#         datefmt="%Y-%m-%d %H:%M:%S"
#     )

#     handler = logging.FileHandler(log_file)
#     handler.setFormatter(formatter)

#     logger = logging.getLogger(name)
#     logger.setLevel(level)
#     logger.addHandler(handler)

#     return logger

# # Create loggers
# fastapi_logger = setup_logger('fastapi', 'logs/fastapi.log', level=logging.DEBUG)
# faust_logger = setup_logger('faust', 'logs/faust.log', level=logging.DEBUG)

# # Optional: setup console logging only for fastapi
# console_handler = logging.StreamHandler()
# console_handler.setFormatter(logging.Formatter(
#     fmt="{asctime} - {levelname} - {name} - {message}",
#     style="{",
#     datefmt="%Y-%m-%d %H:%M:%S"
# ))

# # Add console handler only to fastapi logger
# logging.getLogger('fastapi').addHandler(console_handler)
# # The following line is commented out to prevent faust logs from printing in terminal
# # logging.getLogger('faust').addHandler(console_handler)



# New logger with rotation
import logging
from logging.handlers import RotatingFileHandler

def setup_logger(name, log_file, level=logging.INFO, max_bytes=5*1024*1024, backup_count=5):
    """
    Set up a logger with rotation.
    - max_bytes: Maximum size in bytes before rotating (default 5MB).
    - backup_count: Number of backup files to keep.
    """
    formatter = logging.Formatter(
        fmt="{asctime} - {levelname} - {name} - {message}",
        style="{",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    handler = RotatingFileHandler(
        log_file,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8"
    )
    handler.setFormatter(formatter)

    logger = logging.getLogger(name)
    logger.setLevel(level)
    # Remove old handlers to avoid duplicate logs
    logger.handlers = []
    logger.addHandler(handler)

    return logger

# Create loggers with rotation
fastapi_logger = setup_logger('fastapi', 'logs/fastapi.log', level=logging.DEBUG)
faust_logger = setup_logger('faust', 'logs/faust.log', level=logging.DEBUG)

# Optional: setup console logging only for fastapi
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter(
    fmt="{asctime} - {levelname} - {name} - {message}",
    style="{",
    datefmt="%Y-%m-%d %H:%M:%S"
))

# Add console handler only to fastapi logger
logging.getLogger('fastapi').addHandler(console_handler)
# logging.getLogger('faust').addHandler(console_handler)  # Uncomment if you want faust logs in console too