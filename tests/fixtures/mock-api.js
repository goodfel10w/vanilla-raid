const MOCK_USER = { token: 'mock-token', username: 'Testuser', userId: 'mock-user-1', discordLinked: true, discordUsername: 'Testuser#1234', discordGuildMember: true };

const MOCK_BNET_CHARACTERS = [
  { name: 'Thrallmächtig', realm: 'Thunderstrike', className: 'Schamane', level: 70 },
  { name: 'Arthaslull', realm: 'Thunderstrike', className: 'Paladin', level: 70 },
  { name: 'Dottqueen', realm: 'Thunderstrike', className: 'Hexenmeister', level: 65 },
];

export async function setupMockApi(page, initialEntries = []) {
  const store = initialEntries.map(e => ({ ...e }));

  await page.route('**/api/auth', async (route) => {
    const body = route.request().postDataJSON();

    if (body.action === 'validate') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: MOCK_USER.username, userId: MOCK_USER.userId, discordLinked: MOCK_USER.discordLinked, discordUsername: MOCK_USER.discordUsername, discordGuildMember: MOCK_USER.discordGuildMember }),
      });
      return;
    }

    if (body.action === 'discord-link') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://discord.com/oauth2/authorize?mock=1' }),
      });
      return;
    }

    if (body.action === 'discord-unlink') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (body.action === 'bnet-login') {
      // Return a mock Battle.net OAuth URL — tests can intercept navigation
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://eu.battle.net/oauth/authorize?mock=1' }),
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

  await page.route('**/api/bnet-characters', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ characters: MOCK_BNET_CHARACTERS }),
    });
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
        specs: body.specs || [],
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

  // DKP in-memory state
  const dkpBalances = [];
  const dkpTransactions = [];
  let dkpConfig = {
    roles: { testuser: 'admin' },
    defaultDecayPercent: 50,
    maxDkpAmount: 10000,
    allowNegativeBalance: false,
    startingBalance: 0,
    transactionLimit: 50,
    reasonMaxLength: 200,
    minBid: 5,
    raidAttendanceDkp: 10,
    raidPartialDkp: 5,
    raidBenchDkp: 10,
    bossKillDkp: 5,
    startingBonus: 20,
  };

  await page.route('**/api/dkp**', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      const url = new URL(route.request().url());
      const playerFilter = url.searchParams.get('player');
      if (playerFilter) {
        const playerTx = dkpTransactions.filter(
          t => t.playerName.toLowerCase() === playerFilter.toLowerCase()
        );
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ transactions: playerTx }),
        });
        return;
      }
      const sorted = [...dkpBalances].sort((a, b) => b.balance - a.balance);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balances: sorted,
          transactions: dkpTransactions.slice(0, dkpConfig.transactionLimit || 50),
          config: { ...dkpConfig },
        }),
      });
      return;
    }

    if (method === 'POST') {
      const body = route.request().postDataJSON();
      const { action } = body;

      if (action === 'award') {
        const { players, amount, reason } = body;
        const parsedAmount = Number(amount);
        const results = [];
        for (const p of players) {
          const key = p.name.trim().toLowerCase();
          let existing = dkpBalances.find(b => b.playerName.toLowerCase() === key);
          if (!existing) {
            existing = { playerName: p.name.trim(), className: p.className || '', balance: dkpConfig.startingBalance, hasReceivedStartingBonus: false };
            dkpBalances.push(existing);
          }
          if (p.className) existing.className = p.className;
          existing.balance += parsedAmount;
          existing.lastUpdated = new Date().toISOString();

          const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          dkpTransactions.unshift({
            id: txId,
            playerName: p.name.trim(),
            type: 'earn',
            amount: parsedAmount,
            reason: (reason || '').trim(),
            createdBy: MOCK_USER.username,
            timestamp: new Date().toISOString(),
          });
          results.push({ ...existing });
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, balances: results }),
        });
        return;
      }

      if (action === 'spend') {
        const { playerName, amount, itemName } = body;
        const parsedAmount = Number(amount);
        const key = playerName.trim().toLowerCase();
        const existing = dkpBalances.find(b => b.playerName.toLowerCase() === key);
        if (!existing) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Spieler nicht im DKP-System gefunden' }),
          });
          return;
        }
        if (!dkpConfig.allowNegativeBalance && existing.balance - parsedAmount < 0) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: `Nicht genug DKP (${existing.balance} vorhanden, ${parsedAmount} benötigt)` }),
          });
          return;
        }
        existing.balance -= parsedAmount;
        existing.lastUpdated = new Date().toISOString();

        const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        dkpTransactions.unshift({
          id: txId,
          playerName: playerName.trim(),
          type: 'spend',
          amount: -parsedAmount,
          reason: (itemName || 'Loot').trim(),
          createdBy: MOCK_USER.username,
          timestamp: new Date().toISOString(),
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, balance: { ...existing } }),
        });
        return;
      }

      if (action === 'decay') {
        const percent = Number(body.percent);
        const results = [];
        for (const data of dkpBalances) {
          const decayAmount = Math.round(data.balance * percent / 100);
          if (decayAmount === 0) { results.push({ ...data }); continue; }
          data.balance -= decayAmount;
          data.lastUpdated = new Date().toISOString();

          const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          dkpTransactions.unshift({
            id: txId,
            playerName: data.playerName,
            type: 'decay',
            amount: -decayAmount,
            reason: `${percent}% Verfall`,
            createdBy: MOCK_USER.username,
            timestamp: new Date().toISOString(),
          });
          results.push({ ...data });
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, balances: results }),
        });
        return;
      }

      if (action === 'save-config') {
        if (body.defaultDecayPercent !== undefined) dkpConfig.defaultDecayPercent = Number(body.defaultDecayPercent);
        if (body.maxDkpAmount !== undefined) dkpConfig.maxDkpAmount = Number(body.maxDkpAmount);
        if (body.startingBalance !== undefined) dkpConfig.startingBalance = Number(body.startingBalance);
        if (body.allowNegativeBalance !== undefined) dkpConfig.allowNegativeBalance = !!body.allowNegativeBalance;
        if (body.transactionLimit !== undefined) dkpConfig.transactionLimit = Number(body.transactionLimit);
        if (body.reasonMaxLength !== undefined) dkpConfig.reasonMaxLength = Number(body.reasonMaxLength);
        if (body.minBid !== undefined) dkpConfig.minBid = Number(body.minBid);
        if (body.raidAttendanceDkp !== undefined) dkpConfig.raidAttendanceDkp = Number(body.raidAttendanceDkp);
        if (body.raidPartialDkp !== undefined) dkpConfig.raidPartialDkp = Number(body.raidPartialDkp);
        if (body.raidBenchDkp !== undefined) dkpConfig.raidBenchDkp = Number(body.raidBenchDkp);
        if (body.bossKillDkp !== undefined) dkpConfig.bossKillDkp = Number(body.bossKillDkp);
        if (body.startingBonus !== undefined) dkpConfig.startingBonus = Number(body.startingBonus);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, config: { ...dkpConfig } }),
        });
        return;
      }

      if (action === 'manage-roles') {
        const { username, role, remove } = body;
        if (remove) {
          delete dkpConfig.roles[username.trim().toLowerCase()];
        } else {
          dkpConfig.roles[username.trim().toLowerCase()] = role;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, config: { ...dkpConfig } }),
        });
        return;
      }

      if (action === 'undo') {
        const { transactionId } = body;
        const txIdx = dkpTransactions.findIndex(t => t.id === transactionId);
        if (txIdx < 0) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Transaktion nicht gefunden' }),
          });
          return;
        }
        const tx = dkpTransactions[txIdx];
        const bal = dkpBalances.find(b => b.playerName.toLowerCase() === tx.playerName.toLowerCase());
        if (bal) {
          bal.balance -= tx.amount;
          bal.lastUpdated = new Date().toISOString();
        }
        dkpTransactions.splice(txIdx, 1);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, reversed: tx, balance: bal ? { ...bal } : null }),
        });
        return;
      }

      if (action === 'edit-transaction') {
        const { transactionId, amount, reason } = body;
        const txIdx = dkpTransactions.findIndex(t => t.id === transactionId);
        if (txIdx < 0) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Transaktion nicht gefunden' }),
          });
          return;
        }
        const tx = dkpTransactions[txIdx];
        const oldAmount = tx.amount;
        if (amount !== undefined) {
          const parsed = Number(amount);
          const newAmount = tx.type === 'earn' || tx.type === 'adjust' ? parsed : -parsed;
          const diff = newAmount - oldAmount;
          const bal = dkpBalances.find(b => b.playerName.toLowerCase() === tx.playerName.toLowerCase());
          if (bal) {
            bal.balance += diff;
            bal.lastUpdated = new Date().toISOString();
          }
          tx.amount = newAmount;
        }
        if (reason !== undefined) tx.reason = reason.trim();
        tx.editedBy = MOCK_USER.username;
        tx.editedAt = new Date().toISOString();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, transaction: { ...tx } }),
        });
        return;
      }

      if (action === 'delete-transaction') {
        const { transactionId } = body;
        const txIdx = dkpTransactions.findIndex(t => t.id === transactionId);
        if (txIdx < 0) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Transaktion nicht gefunden' }),
          });
          return;
        }
        const tx = dkpTransactions[txIdx];
        const bal = dkpBalances.find(b => b.playerName.toLowerCase() === tx.playerName.toLowerCase());
        if (bal) {
          bal.balance -= tx.amount;
          bal.lastUpdated = new Date().toISOString();
        }
        dkpTransactions.splice(txIdx, 1);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, reversed: tx, balance: bal ? { ...bal } : null }),
        });
        return;
      }

      if (action === 'adjust-balance') {
        const { playerName, newBalance, reason } = body;
        const key = playerName.trim().toLowerCase();
        const existing = dkpBalances.find(b => b.playerName.toLowerCase() === key);
        if (!existing) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Spieler nicht im DKP-System gefunden' }),
          });
          return;
        }
        const diff = Number(newBalance) - existing.balance;
        existing.balance = Number(newBalance);
        existing.lastUpdated = new Date().toISOString();

        const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        dkpTransactions.unshift({
          id: txId,
          playerName: playerName.trim(),
          type: 'adjust',
          amount: diff,
          reason: (reason || 'Manuelle Anpassung').trim(),
          createdBy: MOCK_USER.username,
          timestamp: new Date().toISOString(),
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, balance: { ...existing } }),
        });
        return;
      }

      if (action === 'edit-player') {
        const { playerName, newName, newClassName } = body;
        const key = playerName.trim().toLowerCase();
        const existing = dkpBalances.find(b => b.playerName.toLowerCase() === key);
        if (!existing) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Spieler nicht im DKP-System gefunden' }),
          });
          return;
        }
        if (newClassName !== undefined) existing.className = newClassName;
        if (newName && newName.trim().toLowerCase() !== key) {
          const newKey = newName.trim().toLowerCase();
          const conflict = dkpBalances.find(b => b.playerName.toLowerCase() === newKey);
          if (conflict) {
            await route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Ein Spieler mit diesem Namen existiert bereits' }),
            });
            return;
          }
          // Update transactions
          dkpTransactions.forEach(t => {
            if (t.playerName.toLowerCase() === key) t.playerName = newName.trim();
          });
          existing.playerName = newName.trim();
        }
        existing.lastUpdated = new Date().toISOString();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, balance: { ...existing } }),
        });
        return;
      }

      if (action === 'delete-player') {
        const { playerName, deleteTransactions } = body;
        const key = playerName.trim().toLowerCase();
        const idx = dkpBalances.findIndex(b => b.playerName.toLowerCase() === key);
        if (idx < 0) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Spieler nicht im DKP-System gefunden' }),
          });
          return;
        }
        dkpBalances.splice(idx, 1);
        if (deleteTransactions) {
          for (let i = dkpTransactions.length - 1; i >= 0; i--) {
            if (dkpTransactions[i].playerName.toLowerCase() === key) {
              dkpTransactions.splice(i, 1);
            }
          }
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
        return;
      }

      // Fallback for unknown actions
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
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
    getDkpBalances: () => [...dkpBalances],
    getDkpTransactions: () => [...dkpTransactions],
    getDkpConfig: () => ({ ...dkpConfig }),
  };
}
