#!/bin/bash

# MongoDB User Management Script
# This script provides utilities to manage MongoDB users

show_help() {
    echo "MongoDB User Management Script"
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  list-users           List all MongoDB users"
    echo "  list-roles          List all custom roles"
    echo "  change-password     Change user password"
    echo "  test-connection     Test connection with specific user"
    echo "  create-user         Create a new user"
    echo "  drop-user           Remove a user"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 list-users"
    echo "  $0 test-connection monitoring_app"
    echo "  $0 change-password monitoring_app"
}

list_users() {
    echo "Listing all MongoDB users..."
    docker exec -it grafanaalertsapp-mongodb-1 mongosh \
        --username "admin" \
        --password "admin123" \
        --authenticationDatabase "admin" \
        --eval "
            db = db.getSiblingDB('admin');
            db.system.users.find({}, {user: 1, roles: 1}).pretty();
        "
}

list_roles() {
    echo "Listing all custom roles..."
    docker exec -it grafanaalertsapp-mongodb-1 mongosh \
        --username "admin" \
        --password "admin123" \
        --authenticationDatabase "admin" \
        --eval "
            db = db.getSiblingDB('admin');
            db.getRoles({showPrivileges: true, showBuiltinRoles: false}).forEach(
                function(role) {
                    print('Role: ' + role.role);
                    print('Database: ' + role.db);
                    print('Privileges: ' + JSON.stringify(role.privileges, null, 2));
                    print('---');
                }
            );
        "
}

test_connection() {
    local username=$1
    if [ -z "$username" ]; then
        echo "Usage: $0 test-connection <username>"
        return 1
    fi
    
    read -s -p "Enter password for $username: " password
    echo ""
    
    echo "Testing connection for user: $username"
    docker exec -it grafanaalertsapp-mongodb-1 mongosh \
        --username "$username" \
        --password "$password" \
        --authenticationDatabase "admin" \
        --eval "
            try {
                db = db.getSiblingDB('monitoring-alerts');
                print('✓ Connection successful');
                print('Current user: ' + db.runCommand('connectionStatus').authInfo.authenticatedUsers[0].user);
                print('Collections accessible: ' + db.listCollectionNames().length);
            } catch (e) {
                print('✗ Connection failed: ' + e.message);
            }
        "
}

change_password() {
    local username=$1
    if [ -z "$username" ]; then
        echo "Usage: $0 change-password <username>"
        return 1
    fi
    
    read -s -p "Enter new password for $username: " new_password
    echo ""
    
    echo "Changing password for user: $username"
    docker exec -it grafanaalertsapp-mongodb-1 mongosh \
        --username "admin" \
        --password "admin123" \
        --authenticationDatabase "admin" \
        --eval "
            db = db.getSiblingDB('admin');
            try {
                db.changeUserPassword('$username', '$new_password');
                print('✓ Password changed successfully for user: $username');
            } catch (e) {
                print('✗ Failed to change password: ' + e.message);
            }
        "
}

create_user() {
    echo "Creating new MongoDB user..."
    read -p "Enter username: " username
    read -s -p "Enter password: " password
    echo ""
    read -p "Enter database name: " database
    read -p "Enter role (read/readWrite/dbAdmin): " role
    
    docker exec -it grafanaalertsapp-mongodb-1 mongosh \
        --username "admin" \
        --password "admin123" \
        --authenticationDatabase "admin" \
        --eval "
            db = db.getSiblingDB('admin');
            try {
                db.createUser({
                    user: '$username',
                    pwd: '$password',
                    roles: [{ role: '$role', db: '$database' }]
                });
                print('✓ User created successfully: $username');
            } catch (e) {
                print('✗ Failed to create user: ' + e.message);
            }
        "
}

drop_user() {
    local username=$1
    if [ -z "$username" ]; then
        echo "Usage: $0 drop-user <username>"
        return 1
    fi
    
    read -p "Are you sure you want to delete user '$username'? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Operation cancelled."
        return 0
    fi
    
    echo "Dropping user: $username"
    docker exec -it grafanaalertsapp-mongodb-1 mongosh \
        --username "admin" \
        --password "admin123" \
        --authenticationDatabase "admin" \
        --eval "
            db = db.getSiblingDB('admin');
            try {
                db.dropUser('$username');
                print('✓ User dropped successfully: $username');
            } catch (e) {
                print('✗ Failed to drop user: ' + e.message);
            }
        "
}

# Main script logic
case "$1" in
    "list-users")
        list_users
        ;;
    "list-roles")
        list_roles
        ;;
    "test-connection")
        test_connection "$2"
        ;;
    "change-password")
        change_password "$2"
        ;;
    "create-user")
        create_user
        ;;
    "drop-user")
        drop_user "$2"
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information."
        exit 1
        ;;
esac
