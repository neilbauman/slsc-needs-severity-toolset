# Embedding the View-Only Dashboard in an iFrame

You can embed the view-only dashboard in an iframe on any website. This is useful for sharing dashboards with stakeholders without giving them access to the editable version.

## Quick Start

### Basic iframe

```html
<iframe 
  src="https://yourdomain.com/instances/[INSTANCE_ID]/view" 
  width="100%" 
  height="800px" 
  frameborder="0"
  allowfullscreen>
</iframe>
```

Replace `[INSTANCE_ID]` with your actual instance ID.

### Example HTML Page

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Philippines SSC Dashboard</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
        }
        .iframe-container {
            width: 100%;
            height: 900px;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
    </style>
</head>
<body>
    <h1>Philippines SSC Vulnerability Dashboard</h1>
    <div class="iframe-container">
        <iframe 
            src="https://yourdomain.com/instances/[INSTANCE_ID]/view"
            allowfullscreen>
        </iframe>
    </div>
</body>
</html>
```

## Embed Route (Cleaner Version)

For a cleaner embed without the header/breadcrumb navigation, use the `/embed` route:

```html
<iframe 
  src="https://yourdomain.com/instances/[INSTANCE_ID]/embed" 
  width="100%" 
  height="800px" 
  frameborder="0">
</iframe>
```

## Responsive iframe

For responsive embedding that adapts to screen size:

```html
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
    <iframe 
        src="https://yourdomain.com/instances/[INSTANCE_ID]/view"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
        frameborder="0"
        allowfullscreen>
    </iframe>
</div>
```

## Security Configuration

The Next.js configuration has been updated to allow iframe embedding with `X-Frame-Options: SAMEORIGIN`. This means:

- ✅ **Same origin**: Can be embedded on the same domain
- ⚠️ **Cross-origin**: For embedding on different domains, you may need to adjust the header

### For Cross-Origin Embedding

If you need to embed on a different domain, update `next.config.js`:

```javascript
module.exports = { 
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL', // Less secure - allows any origin
            // OR use Content-Security-Policy for more control:
            // key: 'Content-Security-Policy',
            // value: "frame-ancestors 'self' https://trusted-domain.com;"
          },
        ],
      },
    ];
  },
};
```

## Finding Your Instance ID

1. Go to your instances list: `https://yourdomain.com/instances`
2. Click on an instance to open it
3. The URL will be: `https://yourdomain.com/instances/[INSTANCE_ID]`
4. Use that `[INSTANCE_ID]` in your iframe URL

## Features Available in iframe

- ✅ Full map visualization
- ✅ Metrics panel
- ✅ Vulnerable locations panel
- ✅ Score distribution
- ✅ Layer selection (datasets, categories, hazard events)
- ✅ Hazard event visibility toggles
- ✅ All interactive features (zoom, pan, popups)
- ❌ No edit capabilities (read-only)

## Troubleshooting

### iframe not displaying

1. **Check browser console** for errors
2. **Verify the URL** is correct and accessible
3. **Check X-Frame-Options header** if embedding cross-origin
4. **Ensure HTTPS** if the parent page is HTTPS (mixed content restrictions)

### Content not loading

1. **Check network tab** in browser dev tools
2. **Verify Supabase credentials** are accessible
3. **Check instance ID** is valid
4. **Ensure scores have been calculated** for the instance

### Map not rendering

1. **Check Leaflet CSS** is loading (should be automatic)
2. **Verify OpenStreetMap tiles** are accessible
3. **Check browser console** for JavaScript errors

## Best Practices

1. **Use HTTPS** for both parent and iframe
2. **Set appropriate height** (recommended: 800-1000px)
3. **Use `allowfullscreen`** attribute for better UX
4. **Test on mobile devices** - may need responsive adjustments
5. **Consider lazy loading** for better performance:

```html
<iframe 
  src="https://yourdomain.com/instances/[INSTANCE_ID]/view"
  loading="lazy"
  width="100%" 
  height="800px">
</iframe>
```

## Example: WordPress Embed

If embedding in WordPress, you can use a custom HTML block:

```html
<div class="ssc-dashboard-embed">
    <iframe 
        src="https://yourdomain.com/instances/[INSTANCE_ID]/view"
        width="100%" 
        height="900px"
        frameborder="0"
        scrolling="no"
        allowfullscreen>
    </iframe>
</div>
```

Add this CSS to your WordPress theme:

```css
.ssc-dashboard-embed {
    position: relative;
    width: 100%;
    max-width: 1200px;
    margin: 20px auto;
}
.ssc-dashboard-embed iframe {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
```

