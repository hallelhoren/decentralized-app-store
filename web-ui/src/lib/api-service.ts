export const AppService = {
  async fetchAllApps() {
    const res = await fetch('/api/apps');
    return res.json();
  },

  async uploadApp(appData: any) {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData),
    });
    return res.json();
  }
};