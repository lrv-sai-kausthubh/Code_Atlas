types/

Since we're using TypeScript,

every object has a type.

Imagine

Project

File

Graph Node

Edge

Instead of writing them everywhere

we define them once.

Example

export interface Project {

    id: string;

    name: string;

}

Now every file knows

what a Project looks like.