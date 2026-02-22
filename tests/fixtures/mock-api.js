const MOCK_USER = { token: 'mock-token', username: 'Testuser', userId: 'mock-user-1' };

export async function setupMockApi(page, initialEntries = []) {
  const store = initialEntries.map(e => ({ ...e }));

  await page.route('**/api/auth', async (route) => {
    const body = route.request().postDataJSON();

    if (body.action === 'validate') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: MOCK_USER.username, userId: MOCK_USER.userId }),
      });
      return;
    }

    if (body.action === 'login' || body.action === 'register') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER),
      });
      return;
    }

    if (body.action === 'logout') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/entries**', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([...store]),
      });
      return;
    }

    if (method === 'POST') {
      const body = route.request().postDataJSON();
      const existingIdx = body.id
        ? store.findIndex(e => e.id === body.id)
        : -1;
      const entry = {
        id: body.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        charName: body.charName,
        className: body.className,
        roles: body.roles || [],
        availability: body.availability || {},
        notes: body.notes || '',
        userId: MOCK_USER.userId,
        timestamp: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        store[existingIdx] = entry;
      } else {
        store.push(entry);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(entry),
      });
      return;
    }

    if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const id = url.searchParams.get('id');
      const idx = store.findIndex(e => e.id === id);
      if (idx >= 0) store.splice(idx, 1);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/raids**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  return {
    getStore: () => [...store],
    getEntry: (id) => store.find(e => e.id === id),
  };
}
