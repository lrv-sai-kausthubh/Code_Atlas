services/

This folder talks to the backend.

Think

React

↓

services

↓

FastAPI

↓

Database

Never call the backend directly from every component.

Instead

api.ts

becomes

uploadProject()

getGraph()

searchFiles()

summarizeProject()

Everything backend-related stays here.