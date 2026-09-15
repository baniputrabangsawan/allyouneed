(function () {
  var context = document.modelContext || (typeof navigator !== 'undefined' && navigator.modelContext)
  if (!context) return
  function go(path) {
    globalThis.location.assign(path)
    return { ok: true, path: path }
  }
  var tools = [
    {
      name: 'search_kits_tools',
      description: 'Search Kits tools by name, format, or task.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      execute: function (input) {
        var query = input && input.query ? String(input.query) : ''
        return go('/?q=' + encodeURIComponent(query))
      },
    },
    {
      name: 'list_kits_tools',
      description: 'Open the Kits tool catalog.',
      inputSchema: { type: 'object' },
      execute: function () { return go('/tools') },
    },
    {
      name: 'open_kits_tool',
      description: 'Open a Kits tool workspace by slug.',
      inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
      execute: function (input) {
        var slug = input && input.slug ? String(input.slug) : ''
        if (!slug) return { ok: false, error: 'missing_slug' }
        return go('/tools/' + encodeURIComponent(slug))
      },
    },
  ]
  if (typeof context.registerTool === 'function') {
    for (var i = 0; i < tools.length; i++) context.registerTool(tools[i])
  } else if (typeof context.provideContext === 'function') {
    context.provideContext({ tools: tools })
  }
})()
