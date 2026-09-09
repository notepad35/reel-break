ObjC.import('Foundation');
ObjC.import('AppKit');


function run() {
    try {
        const input = $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
        const event = JSON.parse(ObjC.unwrap($.NSString.alloc.initWithDataEncoding(input, $.NSUTF8StringEncoding)));
        const session = event.session_id;
        if (typeof session !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(session)) return '{}';
        const opening = event.hook_event_name === 'UserPromptSubmit';
        if (!opening && ['Stop', 'Interrupt', 'SessionEnd'].indexOf(event.hook_event_name) < 0) return '{}';
        const path = ObjC.unwrap($.NSTemporaryDirectory()) + 'reel-break-' + session + '.json';
        const fm = $.NSFileManager.defaultManager;
        let state = null;
        if (fm.fileExistsAtPath(path)) {
            const data = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
            state = JSON.parse(ObjC.unwrap(data));
        }
        if (!opening && state && event.turn_id && state.turn !== event.turn_id) return '{}';
        const chrome = Application('com.google.Chrome');
        let owned = null;
        if (state && chrome.running()) {
            const apps = $.NSRunningApplication.runningApplicationsWithBundleIdentifier('com.google.Chrome');
            const pid = apps.count ? Number(apps.objectAtIndex(0).processIdentifier) : 0;
            if (pid === state.pid) {
                const windows = chrome.windows();
                for (let i = 0; i < windows.length && !owned; i++) {
                    const tabs = windows[i].tabs();
                    for (let j = 0; j < tabs.length; j++) {
                        if (tabs[j].id() === state.tab) { owned = tabs[j]; break; }
                    }
                }
            }
        }
        if (opening) {
            const created = !owned;
            if (created) {
                chrome.launch();
                const window = chrome.Window().make();
                owned = window.tabs[0];
                const apps = $.NSRunningApplication.runningApplicationsWithBundleIdentifier('com.google.Chrome');
                state = {tab: owned.id(), pid: Number(apps.objectAtIndex(0).processIdentifier)};
            }
            const newTurn = created || state.turn !== (event.turn_id || null);
            state.turn = event.turn_id || null;
            const saved = $(JSON.stringify(state)).writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);
            if (!saved) { owned.close(); throw new Error('Could not save tab ownership'); }
            if (newTurn) {
                owned.url = 'https://www.instagram.com/reels/';
            }
            chrome.activate();
        } else {
            if (owned) owned.close();
            if (fm.fileExistsAtPath(path)) fm.removeItemAtPathError(path, null);
        }
    } catch (error) {
        console.log('reel-break: ' + error.message + ' at line ' + error.line);
    }
    return '{}';
}
