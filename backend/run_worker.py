"""Launch the ARQ worker for GEOTrack scan jobs."""
import asyncio
from app.services.scan_queue import create_worker


async def main():
    worker = await create_worker()
    await worker.async_run()


if __name__ == "__main__":
    asyncio.run(main())
