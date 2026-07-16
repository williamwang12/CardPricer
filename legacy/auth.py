"""Authentication helpers using Streamlit's built-in OIDC auth."""

import streamlit as st


def require_login() -> bool:
    """Return True if user is logged in, otherwise show login button."""
    if not st.user.is_logged_in:
        st.title("Pokemon Raw Card Inventory")
        st.login("google")
        return False
    return True


def get_user_email() -> str:
    """Return the logged-in user's email address."""
    return st.user.email


def show_user_info() -> None:
    """Display user info and logout button in the sidebar."""
    with st.sidebar:
        st.write(f"**{st.user.name}**")
        st.caption(st.user.email)
        st.logout(":material/logout: Log out")
