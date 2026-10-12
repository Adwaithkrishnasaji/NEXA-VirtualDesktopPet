const { openWhatsAppDesktop } = require('./localActions');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

function validateContactName(contactName) {
  if (typeof contactName !== 'string' || !contactName.trim() || contactName.trim().length > 100
    || /[\u0000-\u001f\u007f]/.test(contactName)) {
    throw new Error('Provide an exact WhatsApp contact name.');
  }
  return contactName.trim();
}

async function verifyWhatsAppSearch(expectedValue) {
  const script = [
    'Add-Type -AssemblyName UIAutomationClient',
    'Add-Type -AssemblyName UIAutomationTypes',
    '$focused = [System.Windows.Automation.AutomationElement]::FocusedElement',
    'if (-not $focused -or $focused.Current.ProcessId -eq 0) { throw "WhatsApp search is not focused." }',
    '$process = Get-Process -Id $focused.Current.ProcessId -ErrorAction Stop',
    'if ($process.ProcessName -notmatch "WhatsApp") { throw "WhatsApp is not the active desktop window." }',
    'if (@([System.Windows.Automation.ControlType]::Edit, [System.Windows.Automation.ControlType]::ComboBox) -notcontains $focused.Current.ControlType) { throw "WhatsApp search is not focused." }',
    'if ($focused.Current.Name -notmatch "(?i)search|find") { throw "WhatsApp search is not focused." }',
    'if ($env:NEXA_WHATSAPP_VERIFY_RESULTS -eq "true") {',
    '  $expected = $env:NEXA_WHATSAPP_SEARCH_TEXT',
    '  $pattern = $focused.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)',
    '  if ($pattern.Current.Value -cne $expected) { throw "WhatsApp search did not accept the exact contact name." }',
    '  $window = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$process.MainWindowHandle)',
    '  $matches = New-Object System.Collections.Generic.List[System.Windows.Automation.AutomationElement]',
    '  $ids = New-Object "System.Collections.Generic.HashSet[string]"',
    '  foreach ($type in @([System.Windows.Automation.ControlType]::ListItem, [System.Windows.Automation.ControlType]::TreeItem, [System.Windows.Automation.ControlType]::DataItem)) {',
    '    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $type)',
    '    foreach ($item in $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)) { if (-not $item.Current.IsOffscreen -and $item.Current.Name.Trim() -ieq $expected) { $id = [string]::Join(".", $item.GetRuntimeId()); if ($ids.Add($id)) { $matches.Add($item) } } }',
    '  }',
    '  if ($matches.Count -ne 1) { throw "WhatsApp must show exactly one visible chat matching that contact name." }',
    '}',
    'Write-Output "NEXA_WHATSAPP_SEARCH_OK"',
  ].join('\n');
  let stdout;
  try {
    ({ stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ], {
      windowsHide: true,
      timeout: 10_000,
      env: {
        ...process.env,
        NEXA_WHATSAPP_SEARCH_TEXT: expectedValue ?? '',
        NEXA_WHATSAPP_VERIFY_RESULTS: String(expectedValue !== undefined),
      },
    }));
  } catch (error) {
    throw new Error(`Could not verify the WhatsApp search field and exact contact: ${error.message}`);
  }
  if (!stdout.includes('NEXA_WHATSAPP_SEARCH_OK')) {
    throw new Error('WhatsApp did not confirm the exact contact in its search results.');
  }
}

async function verifyWhatsAppForeground() {
  const script = [
    'Add-Type -AssemblyName UIAutomationClient',
    '$focused = [System.Windows.Automation.AutomationElement]::FocusedElement',
    'if (-not $focused -or $focused.Current.ProcessId -eq 0) { throw "WhatsApp is not the active desktop window." }',
    '$process = Get-Process -Id $focused.Current.ProcessId -ErrorAction Stop',
    'if ($process.ProcessName -notmatch "WhatsApp") { throw "WhatsApp is not the active desktop window." }',
    'Write-Output "NEXA_WHATSAPP_FOREGROUND_OK"',
  ].join('\n');
  let stdout;
  try {
    ({ stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ], { windowsHide: true, timeout: 10_000 }));
  } catch (error) {
    throw new Error(`Could not verify the WhatsApp window is focused: ${error.message}`);
  }
  if (!stdout.includes('NEXA_WHATSAPP_FOREGROUND_OK')) {
    throw new Error('WhatsApp is not the active desktop window; no keyboard input was sent.');
  }
}

async function selectWhatsAppChat(contactName) {
  const exactContactName = validateContactName(contactName);
  if (process.platform !== 'win32') {
    throw new Error('Selecting WhatsApp chats is currently supported on Windows.');
  }

  const robot = require('robotjs');
  await openWhatsAppDesktop();
  await new Promise((resolve) => setTimeout(resolve, 800));
  await verifyWhatsAppForeground();
  robot.keyTap('f', 'control');
  await new Promise((resolve) => setTimeout(resolve, 200));
  await verifyWhatsAppSearch(undefined);
  robot.keyTap('a', 'control');
  robot.typeString(exactContactName);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await verifyWhatsAppSearch(exactContactName);
  robot.keyTap('enter');
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    success: true,
    contactName: exactContactName,
    message: `Po mone Dinesha, ${exactContactName}-ude chat thurannittundu!`,
  };
}

module.exports = { selectWhatsAppChat };
