#!/usr/bin/env python3
"""
Migration script to add admin columns to existing database
"""

import os
import sys
from dotenv import load_dotenv
# Add the current directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from sqlalchemy import text

def migrate_database():
    """Add admin columns to existing database"""
    with app.app_context():
        try:
            # Check if columns already exist
            result = db.session.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            
            print("Current columns:", columns)
            
            # Add is_admin column if it doesn't exist
            if 'is_admin' not in columns:
                db.session.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE"))
                print("✅ Added is_admin column")
            else:
                print("ℹ️  is_admin column already exists")
            
            # Add is_banned column if it doesn't exist
            if 'is_banned' not in columns:
                db.session.execute(text("ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT FALSE"))
                print("✅ Added is_banned column")
            else:
                print("ℹ️  is_banned column already exists")
            
            db.session.commit()
            print("✅ Database migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            db.session.rollback()
            raise

def create_admin_user():
    """Create the first admin user"""
    from models import User
    
    with app.app_context():
        # Check if admin user already exists
        admin_user = User.query.filter_by(is_admin=True).first()
        if admin_user:
            print(f"Admin user already exists: {admin_user.username}")
            return admin_user
        
        # Create admin user
        admin = User()
        admin.username = os.getenv("ADMIN_USERNAME")
        admin.email = os.getenv("ADMIN_EMAIL")
        admin.first_name = os.getenv("ADMIN_FIRST_NAME")    
        admin.last_name = os.getenv("ADMIN_LAST_NAME")
        admin.is_admin = True
        admin.is_banned = False
        admin.set_password(os.getenv("ADMIN_PASSWORD"))
        
        db.session.add(admin)
        db.session.commit()
        
        print("✅ Admin user created successfully!")
        print("Username:"+ admin.username)
        print("Password:" + os.getenv("ADMIN_PASSWORD"))
        print("⚠️  IMPORTANT: Change the password after first login!")
        
        return admin

def main():
    """Main migration function"""
    print("🔄 Migrating WatchWithMe Database...")
    print("=" * 50)
    
    try:
        # Migrate database
        migrate_database()
        
        # Create admin user
        create_admin_user()
        
        print("=" * 50)
        print("✅ Migration completed successfully!")
        print("\n📋 Next steps:")
        print("1. Run your Flask application: python app.py")
        print("2. Go to http://localhost:5000")
        print("3. Login with admin/admin123")
        print("4. Change the admin password immediately!")
        print("5. Access admin panel at http://localhost:5000/admin")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()