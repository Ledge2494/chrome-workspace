import { importFromJson } from '@src/workspaceAPI/import';

const fileChooser = document.getElementById('import-file') as HTMLInputElement;

// Handle file selection
fileChooser.addEventListener('change', async function () {
  const file = fileChooser.files?.[0];
  if (!file) return;

  try {
    const content = await file.text();
    await importFromJson(content);
    console.log('Import workspaces completed');
    // Close the window after successful import
    window.close();
  } catch (error) {
    console.error('Failed to import workspaces:', error);
  }
});

setTimeout(() => {
  fileChooser.click();
}, 5000);

export default {};
