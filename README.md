# Minecraft Chunk Viewer

React + DeckGL viewer for Minecraft Anvil region files (`.mca`).

## Run

```bash
npm install
npm run dev
```

Open the local Vite URL and load an `.mca` file from a Minecraft `region`
directory. The viewer parses chunk NBT in the browser, renders the selected
chunk as instanced DeckGL cubes, and uses the left vertical slider to clip the
visible Y layer.

The project includes one test region from a current Minecraft world:
`public/samples/r.0.0.mca`.
