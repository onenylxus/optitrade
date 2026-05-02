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

    def say_hello_with_prefix(self, name: str, prefix: str = "Hello") -> str:
        """Generate a greeting with a configurable prefix."""
        return f"{prefix}, {name}!"

    def say_hello_with_suffix(self, name: str, suffix: str = "!") -> str:
        """Generate a greeting with a configurable suffix."""
        return f"Hello, {name}{suffix}"

    def say_goodbye(self, name: str) -> str:
        """Generate a goodbye message."""
        return f"Goodbye, {name}!"

    def aggregate_hellos(self, names: list[str]) -> str:
        """Generate a single response that includes greetings for multiple names."""
        if not names:
            return "Hello, nobody!"
        return " | ".join(self.say_hello(name) for name in names)
