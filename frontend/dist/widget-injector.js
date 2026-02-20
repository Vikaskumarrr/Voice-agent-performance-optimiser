// Widget injector: loads the React app inside a shadow DOM container
// to isolate styles from the HighLevel host page.
(function () {
  if (document.getElementById('voice-ai-optimizer-widget')) return;

  var host = document.createElement('div');
  host.id = 'voice-ai-optimizer-widget';
  host.style.position = 'fixed';
  host.style.bottom = '16px';
  host.style.right = '16px';
  host.style.zIndex = '999999';
  document.body.appendChild(host);

  var shadow = host.attachShadow({ mode: 'open' });

  var container = document.createElement('div');
  container.id = 'root';
  shadow.appendChild(container);

  // Load the built app CSS
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/index.css';
  shadow.appendChild(link);

  // Load the built app JS
  var script = document.createElement('script');
  script.type = 'module';
  script.src = '/assets/index.js';
  document.head.appendChild(script);
})();
