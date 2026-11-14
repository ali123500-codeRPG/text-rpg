// esbuild's file loader turns an imported sound into the URL of its copy in assets/ (scripts/build.mjs)
declare module '*.mp3' { const url: string; export default url; }
