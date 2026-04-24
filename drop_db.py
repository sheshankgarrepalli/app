from sqlalchemy import create_engine, MetaData, text
from api.config import settings

def drop_all_tables():
    url = settings.DATABASE_URL
    if not url.startswith("postgresql+"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    
    engine = create_engine(url)
    metadata = MetaData()
    metadata.reflect(bind=engine)
    
    with engine.connect() as conn:
        # Drop all tables with CASCADE
        for table in reversed(metadata.sorted_tables):
            print(f"Dropping table {table.name}...")
            conn.execute(text(f'DROP TABLE IF EXISTS "{table.name}" CASCADE'))
        
        # Drop all custom ENUM types
        # Query for all custom types in the public schema
        result = conn.execute(text("SELECT n.nspname as schema, t.typname as type FROM pg_type t LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace WHERE (t.typrelid = 0 OR (SELECT c.relkind = 'c' FROM pg_catalog.pg_class c WHERE c.oid = t.typrelid)) AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_type el WHERE el.oid = t.typelem AND el.typarray = t.oid) AND n.nspname = 'public'"))
        for row in result:
            print(f"Dropping type {row.type}...")
            conn.execute(text(f'DROP TYPE IF EXISTS "{row.type}" CASCADE'))
            
        conn.commit()
    print("All tables and types dropped.")

if __name__ == "__main__":
    drop_all_tables()
