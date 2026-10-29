# threejs-camera-comparison

Interactive comparison of the three.js `PerspectiveCamera` and `OrthographicCamera`.

- **Camera view** (left / top): what the active camera renders.
- **Observer view** (right / bottom): the scene seen from outside, with the active camera's frustum drawn as a pyramid (perspective) or a box (orthographic).

Switching cameras keeps the same viewpoint and framing, so the projection is the only thing that changes. The field-of-view slider performs a dolly zoom: as the FOV shrinks the camera backs away to keep the framing, and the image approaches an orthographic projection.

Link straight to a mode with `#perspective` or `#orthographic`.

## Development

```sh
yarn
yarn dev      # http://localhost:3000
yarn build    # outputs to dist/
yarn preview
```

## Deployment

Deploys to Vercel with zero configuration: the Vite preset runs `yarn build` and serves `dist/`.
