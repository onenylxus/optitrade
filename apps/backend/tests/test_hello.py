"""Hello unit test module."""

from apps.backend.hello import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello apps/backend"
