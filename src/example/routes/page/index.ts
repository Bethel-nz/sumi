import { Context } from 'hono';

export default {
  get: (c: Context) => {
    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sumi Static File Example</title>
          <style>
              body {
                  margin: 0;
                  padding: 0;
                  font-family: system-ui, -apple-system, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  min-height: 100vh;
                  background-color: #f5f5f5;
              }
              .container {
                  max-width: 800px;
                  padding: 2rem;
                  text-align: center;
              }
              .image-container {
                  margin: 2rem 0;
                  border-radius: 12px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              img {
                  max-width: 100%;
                  height: auto;
                  display: block;
              }
              h1 {
                  color: #333;
                  margin-bottom: 1rem;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🔥 Sumi Static File Server Test</h1>
              <div class="image-container">
                  <img src="/static/images/gradient-logo.jpg" alt="Gradient Background">
              </div>
              <p>This image is served from the static directory!</p>
          </div>
      </body>
      </html>
    `);
  }
}; 