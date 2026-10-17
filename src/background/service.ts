import { errorMessage } from '../core/errors';
import { hasMessageType } from '../core/worker-contract';
import { reportCaptureFailure, startCapture } from './capture-jobs';
import { handleTabRemoved, recoverJobs } from './job-recovery';
import { openLibrary } from './library-tab';
import { handleWorkerMessage } from './worker-messages';

export function installBackground(): void {
    chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
        if (sender.id !== chrome.runtime.id || !hasMessageType(message))
            return;

        void handleWorkerMessage(message, sender).then(reply, error => {
            console.error('[offshelf] message failed', { type: message.type, error: errorMessage(error) });
            reply({ ok: false, error: errorMessage(error) });
        });

        return true;
    });
    chrome.runtime.onInstalled.addListener(() => {
        void chrome.contextMenus.removeAll().then(() => {
            chrome.contextMenus.create({ id: 'offshelf-save', title: 'Save page to Offshelf', contexts: ['page'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
            chrome.contextMenus.create({ id: 'offshelf-selection', title: 'Save selection to Offshelf', contexts: ['selection'] });
        });
        void chrome.alarms.create('offshelf-recover', { periodInMinutes: 1 });
    });
    chrome.runtime.onStartup.addListener(() => { void recoverJobs(); void chrome.alarms.create('offshelf-recover', { periodInMinutes: 1 }); });
    chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'offshelf-recover')
        void recoverJobs(); });
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        const tabId = tab?.id;

        if (!tabId)
            return;

        void startCapture(tabId, info.menuItemId === 'offshelf-selection' ? 'selection' : 'auto').catch(error => reportCaptureFailure(tabId, error));
    });
    chrome.commands.onCommand.addListener((command, tab) => {
        if (command === 'open-library') {
            void openLibrary();

            return;
        }

        const tabId = tab?.id;

        if (command === 'save-page' && tabId)
            void startCapture(tabId).catch(error => reportCaptureFailure(tabId, error));
    });
    chrome.tabs.onRemoved.addListener(handleTabRemoved);
}
