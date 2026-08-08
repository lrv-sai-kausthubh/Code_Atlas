public/ = Decorations outside the house
assets/ = Furniture and images inside the house
components/ = Individual Lego pieces (reusable)
pages/ = Entire rooms
services/ = Telephone line to the backend
types/ = Blueprints describing data
App.tsx = House manager
main.tsx = Main entrance
index.css = Global paint/theme


// info about other files
App.tsx

This is the boss of the frontend.

Think

App

↓

Home

↓

Workspace

↓

Settings

↓

About

Eventually

App decides

Which page should be shown?

Currently

App

↓

Home

Very simple.

main.tsx

This is where React starts.

Imagine

Browser

↓

main.tsx

↓

App.tsx

↓

Everything Else

If main.tsx doesn't exist

React cannot start.

It is literally

main()


for React.

App.css

Currently

page-specific styling.

Eventually

you may remove it

because we'll mostly use

Tailwind CSS.

index.css

Global styles.

Everything on the website gets affected.

Example

body

font

background

scrollbar

colors

If every page should have

background:black

you put it here.
