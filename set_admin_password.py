#!/usr/bin/env python3
"""
Script to set admin password for WatchWithMe without interactive input
"""

import os
import sys

# Add the current directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import User

def set_admin_password(new_password="Admin123!"):
    """Set the admin user's password to a specific value"""
    with app.app_context():
        # Find the admin user
        admin_user = User.query.filter_by(is_admin=True).first()
        
        if not admin_user:
            print("❌ No admin user found!")
            print("Run setup_admin.py first to create an admin user.")
            return False
        
        print(f"🔍 Found admin user: {admin_user.username}")
        print(f"   Email: {admin_user.email}")
        print(f"   Display name: {admin_user.display_name}")
        
        # Validate password
        if len(new_password) < 6:
            print("❌ Password must be at least 6 characters long!")
            return False
        
        # Update the password
        admin_user.set_password(new_password)
        db.session.commit()
        
        print("✅ Admin password set successfully!")
        print(f"   Username: {admin_user.username}")
        print(f"   New password: {new_password}")
        
        return True

def main():
    """Main function"""
    print("🔐 WatchWithMe Admin Password Set Tool")
    print("=" * 50)
    
    # You can change this password to whatever you want
    new_password = "Admin123!"
    
    try:
        if set_admin_password(new_password):
            print("\n✅ Password set completed!")
            print("\n📋 Login credentials:")
            print(f"   Username: admin")
            print(f"   Password: {new_password}")
            print("\n📋 Next steps:")
            print("1. Run your Flask application: python app.py")
            print("2. Go to http://localhost:5000")
            print("3. Login with the credentials above")
            print("4. Access admin panel at http://localhost:5000/admin")
        else:
            print("\n❌ Password set failed!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
