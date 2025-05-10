import asyncio
from prisma import Prisma, register
import os

# --- Main Test Logic ---
async def main():
    """
    Minimal test to initialize the Prisma client and connect to the database.
    """
    print("--- Starting Prisma Connection Test ---")
    
    print(f"Current working directory: {os.getcwd()}")
    env_path = os.path.join(os.getcwd(), '.env')
    schema_path = os.path.join(os.getcwd(), 'prisma', 'schema.prisma') # Define schema path

    if os.path.exists(env_path):
        print(f"Found .env file at: {env_path}")
    else:
        print(f"Warning: No .env file found in the current directory.")
        print("Ensure your DATABASE_URL is set as an environment variable or the .env file is present.")

    if os.path.exists(schema_path):
         print(f"Found schema file at: {schema_path}")
    else:
         print(f"Warning: Cannot find schema at expected location: {schema_path}")


    prisma = None 
    try:
        # 1. Initialize Prisma Client
        print("Initializing Prisma client...")
        
        # --- Attempt 1: Standard Initialization ---
        #Prisma = Prisma() 
        
        # --- Attempt 2 (If Attempt 1 fails): Explicit Schema Path ---
        # If the standard init fails with 'Client not generated', comment out the line above 
        # and uncomment the line below to explicitly point to the schema.
        prisma = Prisma(schema_path=schema_path) 
        
        print("Prisma client initialized.")

        # 2. Connect to the database
        print("Attempting to connect to the database...")
        await prisma.connect()
        print("SUCCESS: Database connected successfully!")

    except RuntimeError as e:
        if "Client hasn't been generated yet" in str(e):
             print("\nERROR: Encountered the 'Client hasn't been generated yet' error.")
             print("This confirms the Python client cannot find the generated artifacts.")
             print("Troubleshooting steps:")
             print("  1. Ensure 'npx prisma generate' completed successfully in the 'server' directory.")
             print("  2. Ensure you are running this Python script from the 'server' directory.")
             print("  3. Ensure the Python virtual environment is activated.")
             print("  4. Try the clean reinstall of 'prisma' pip package.")
             # print("  5. Try uncommenting the 'Prisma(schema_path=...)' line in this script.") # Suggestion added
             print("  6. Check file permissions for the 'node_modules/.prisma/client' folder.")
             print(f"  Detailed Error: {e}")
        else:
             print(f"\nERROR: An unexpected runtime error occurred: {e}")
             
    except Exception as e:
        print(f"\nERROR: Failed to connect or query the database: {e}")
        print("Troubleshooting steps:")
        print("  1. Verify the DATABASE_URL in your .env file is correct.")
        print("  2. Ensure the PostgreSQL server is running.")
        print("  3. Check database user credentials and permissions.")
        print("  4. Check network connectivity/firewall rules if the DB is remote.")

    finally:
        if prisma and prisma.is_connected():
            print("Disconnecting from the database...")
            await prisma.disconnect()
            print("Database disconnected.")
        else:
            print("No active connection to disconnect.")
        print("--- Connection Test Finished ---")

# --- Run the main async function ---
if __name__ == '__main__':
    try:
        # Registration happens implicitly now with Prisma() constructor
        # register(prisma) # No longer needed here
        print("Attempting to run main test function...")
        asyncio.run(main())
    except Exception as registration_error: # Catch errors during script execution setup
         print(f"\nFATAL ERROR: Failed during script execution setup: {registration_error}")
         if "Client hasn't been generated yet" in str(registration_error):
              print("This likely means the core issue is finding the generated client even before main() runs.")
         else:
              print("An unexpected error occurred even before connecting.")

