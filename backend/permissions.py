"""Role-Based Access Control (RBAC) for DecidePlease.

Roles (in order of privilege):
- user: Regular customer
- employee: Support staff (read-only + password resets)
- admin: Full user management (credits, delete, staff management)
- superadmin: Everything including admin management and impersonation
"""

from typing import Optional
from fastapi import Depends, HTTPException, status

# Role hierarchy (lowest to highest privilege)
ROLE_HIERARCHY = ['user', 'employee', 'admin', 'superadmin']

# Permission definitions - which roles can perform which actions
PERMISSIONS = {
    # Dashboard & viewing
    'view_dashboard': ['employee', 'admin', 'superadmin'],
    'view_users': ['employee', 'admin', 'superadmin'],
    'view_user_detail': ['employee', 'admin', 'superadmin'],
    'view_conversations': ['employee', 'admin', 'superadmin'],
    'view_payments': ['admin', 'superadmin'],
    'view_queries': ['employee', 'admin', 'superadmin'],
    'view_metrics': ['admin', 'superadmin'],
    'view_audit_log': ['admin', 'superadmin'],

    # User management
    'modify_credits': ['admin', 'superadmin'],
    'delete_users': ['admin', 'superadmin'],
    'send_password_reset': ['employee', 'admin', 'superadmin'],

    # Staff management
    'manage_employees': ['admin', 'superadmin'],
    'manage_admins': ['superadmin'],

    # Special powers
    'impersonate': ['superadmin'],
    'unlimited_credits': ['admin', 'superadmin'],

    # Future: conversion tracking
    'manage_landing_pages': ['admin', 'superadmin'],
    'view_conversion_metrics': ['admin', 'superadmin'],
}


def has_permission(user_role: Optional[str], permission: str) -> bool:
    """Check if a role has a specific permission.

    Args:
        user_role: The user's role (user, employee, admin, superadmin)
        permission: The permission to check

    Returns:
        True if the role has the permission, False otherwise
    """
    if not user_role:
        return False
    return user_role in PERMISSIONS.get(permission, [])


def get_role_level(role: Optional[str]) -> int:
    """Get the numeric level of a role (higher = more privilege).

    Args:
        role: The role to check

    Returns:
        Numeric level (0 for user, 3 for superadmin)
    """
    if not role or role not in ROLE_HIERARCHY:
        return 0
    return ROLE_HIERARCHY.index(role)


def is_staff(role: Optional[str]) -> bool:
    """Check if a role is any kind of staff (not a regular user).

    Args:
        role: The role to check

    Returns:
        True if employee, admin, or superadmin
    """
    return role in ['employee', 'admin', 'superadmin']


def can_manage_role(manager_role: Optional[str], target_role: str) -> bool:
    """Check if a manager role can modify users of a target role.

    - Admins can manage employees and users
    - Superadmins can manage anyone

    Args:
        manager_role: The role of the person making the change
        target_role: The role of the user being changed

    Returns:
        True if the manager can modify the target user
    """
    if not manager_role:
        return False

    manager_level = get_role_level(manager_role)
    target_level = get_role_level(target_role)

    # Can only manage roles lower than your own
    return manager_level > target_level


def can_assign_role(manager_role: Optional[str], new_role: str) -> bool:
    """Check if a manager can assign a specific role to a user.

    - Admins can assign 'user' or 'employee'
    - Superadmins can assign any role except 'superadmin' (to prevent lockout)

    Args:
        manager_role: The role of the person assigning
        new_role: The role to be assigned

    Returns:
        True if the assignment is allowed
    """
    if not manager_role:
        return False

    # Superadmins can assign up to admin (not superadmin to prevent accidents)
    if manager_role == 'superadmin':
        return new_role in ['user', 'employee', 'admin']

    # Admins can assign user or employee
    if manager_role == 'admin':
        return new_role in ['user', 'employee']

    return False


class PermissionChecker:
    """FastAPI dependency for checking permissions."""

    def __init__(self, permission: str):
        self.permission = permission

    async def __call__(self, user_role: str = None):
        """Check if the current user has the required permission.

        Note: This should be called with the user's role from the JWT.
        The actual dependency injection happens in admin.py.
        """
        if not has_permission(user_role, self.permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {self.permission} required"
            )
        return True


# Pre-built permission checkers for common uses
require_view_dashboard = PermissionChecker('view_dashboard')
require_view_users = PermissionChecker('view_users')
require_modify_credits = PermissionChecker('modify_credits')
require_delete_users = PermissionChecker('delete_users')
require_manage_employees = PermissionChecker('manage_employees')
require_manage_admins = PermissionChecker('manage_admins')
require_impersonate = PermissionChecker('impersonate')
