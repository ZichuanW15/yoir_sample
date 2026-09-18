"""Transactional email: one provider seam, Jinja templates, one function per message.

Named `mail` rather than `email` so it can never be confused with the standard
library's `email` package by a reader, even though Python's absolute imports would
keep them apart.
"""
