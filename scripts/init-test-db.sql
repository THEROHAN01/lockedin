-- Runs once, on first boot of the Postgres volume.
-- Integration tests get their own database so they can truncate freely.
CREATE DATABASE lockedin_test OWNER lockedin;
