import sys
from mbutil import mbtiles_to_disk

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python extract_tiles.py <mbtiles_file> <output_directory>")
        sys.exit(1)
    mbtiles_file = sys.argv[1]
    output_directory = sys.argv[2]
    mbtiles_to_disk(mbtiles_file, output_directory)