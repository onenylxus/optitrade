"""Shared business logic for greeter service."""


class GreeterService:
    """Service for greeting operations."""

    def say_hello(self, name: str) -> str:
        """
        Generate a hello message for the given name.

        Args:
            name: The name to greet.

        Returns:
            A greeting message.
        """
        return f"Hello, {name}!"
