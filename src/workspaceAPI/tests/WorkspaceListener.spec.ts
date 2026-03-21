import { WorkspaceListener, BackgroundMessageEnum } from '../WorkspaceListener';
import { WorkspaceService } from '../WorkspaceService';

jest.mock('lodash/debounce', () =>
  jest.fn(fn => {
    const mockedDebounce = Object.assign(fn, {
      cancel: jest.fn(),
      flush: jest.fn(),
    });
    return mockedDebounce;
  })
);

describe('WorkspaceListener', () => {
  let listener: WorkspaceListener;
  let mockService: jest.Mocked<WorkspaceService>;

  beforeEach(() => {
    mockService = {
      isSessionRestart: jest.fn(),
      restoreAllWorkspacesAfterRestart: jest.fn(),
      saveCurrentWindow: jest.fn().mockResolvedValue(undefined),
      assignWorkspaceToNewWindow: jest.fn(),
      restoreWorkspace: jest.fn(),
      clearActiveWorkspaceForWindow: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceService>;

    listener = new WorkspaceListener(mockService);

    // Clear mocks
    jest.clearAllMocks();

    // Setup chrome API mocks
    global.chrome = {
      windows: {
        onCreated: { addListener: jest.fn() },
        onRemoved: { addListener: jest.fn() },
      },
      tabs: {
        onCreated: { addListener: jest.fn() },
        onRemoved: { addListener: jest.fn() },
        onUpdated: { addListener: jest.fn() },
        onMoved: { addListener: jest.fn() },
        onAttached: { addListener: jest.fn() },
        onDetached: { addListener: jest.fn() },
      },
      tabGroups: {
        onCreated: { addListener: jest.fn() },
        onUpdated: { addListener: jest.fn() },
        onRemoved: { addListener: jest.fn() },
        onMoved: { addListener: jest.fn() },
      },
      runtime: {
        onMessage: { addListener: jest.fn() },
      },
    } as any;
  });

  describe('installAutoSaveListeners', () => {
    it('should add listeners to chrome APIs exactly once', () => {
      listener.installAutoSaveListeners();
      listener.installAutoSaveListeners(); // Second call should be ignored

      expect(chrome.windows.onCreated.addListener).toHaveBeenCalledTimes(1);
      expect(chrome.windows.onRemoved.addListener).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.onCreated.addListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('window and tab listeners', () => {
    beforeEach(() => {
      listener.installAutoSaveListeners();
    });

    it('should schedule save on window creation', async () => {
      const onCreatedTab = (chrome.tabs.onCreated.addListener as jest.Mock).mock
        .calls[0][0];
      onCreatedTab({ windowId: 10 });
      expect((listener as any).saveMap.has(10)).toBe(true);
    });

    it('should schedule save on tab updated', async () => {
      const onUpdated = (chrome.tabs.onUpdated.addListener as jest.Mock).mock
        .calls[0][0];
      onUpdated(1, {}, { windowId: 11 });
      expect((listener as any).saveMap.has(11)).toBe(true);
    });

    it('should handle end window on removed', async () => {
      const onRemovedWindow = (
        chrome.windows.onRemoved.addListener as jest.Mock
      ).mock.calls[0][0];
      await onRemovedWindow(12);
      expect(mockService.clearActiveWorkspaceForWindow).toHaveBeenCalledWith(
        12
      );
    });
  });

  describe('installBackgroundListeners', () => {
    it('should add background runtime message listener exactly once', () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      listener.installBackgroundListeners(mockHandler);
      listener.installBackgroundListeners(mockHandler);

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    });

    it('should handle background messages and invoke the handler', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      listener.installBackgroundListeners(mockHandler);

      const addListenerCall = (
        chrome.runtime.onMessage.addListener as jest.Mock
      ).mock.calls[0][0];
      const sendResponse = jest.fn();

      const message = {
        type: BackgroundMessageEnum.SWITCH,
        payload: { workspaceName: 'Test', windowId: 1 },
      };

      const result = addListenerCall(message, {}, sendResponse);

      expect(mockHandler).toHaveBeenCalledWith(message.payload);
      expect(result).toBe(true);

      // Wait for the promise inside handler to resolve
      await Promise.resolve();
      await Promise.resolve(); // Extra tick to allow then() to execute

      expect(sendResponse).toHaveBeenCalledWith({ onGoing: false });
    });
  });

  describe('session handling', () => {
    it('should detect session restart via service', async () => {
      mockService.isSessionRestart.mockResolvedValue(true);
      const result = await listener.detectSessionRestart();
      expect(result).toBe(true);
      expect(mockService.isSessionRestart).toHaveBeenCalled();
    });

    it('should handle session start and suspend/resume auto-save', async () => {
      await listener.handleSessionStart();

      expect(mockService.restoreAllWorkspacesAfterRestart).toHaveBeenCalled();
    });
  });

  describe('suspend and resume auto-save', () => {
    it('should suspend and cancel scheduled saves', () => {
      // Setup a scheduled save conceptually
      (listener as any).saveMap.set(1, { cancel: jest.fn() });

      listener.suspendAutoSave();

      expect((listener as any).suspended).toBe(true);
      expect((listener as any).saveMap.size).toBe(0);
    });

    it('should resume auto-save', () => {
      listener.suspendAutoSave();
      listener.resumeAutoSave();
      expect((listener as any).suspended).toBe(false);
    });
  });

  describe('handleNewWindow', () => {
    it('should return early when restoring after restart', async () => {
      (listener as any).setRestoringAfterRestart(true);

      await (listener as any).handleNewWindow(5);

      expect(mockService.assignWorkspaceToNewWindow).not.toHaveBeenCalled();
      expect(mockService.restoreWorkspace).not.toHaveBeenCalled();
    });

    it('should assign and restore workspace for new window', async () => {
      mockService.assignWorkspaceToNewWindow.mockResolvedValue(
        'DefaultWorkspace'
      );

      await (listener as any).handleNewWindow(5);

      expect(mockService.assignWorkspaceToNewWindow).toHaveBeenCalledWith(5);
      expect(mockService.restoreWorkspace).toHaveBeenCalledWith(
        5,
        'DefaultWorkspace'
      );
    });

    it('should cancel scheduled saves before restoring workspace', async () => {
      const mockDebounceFn = { cancel: jest.fn() };
      (listener as any).saveMap.set(5, mockDebounceFn);
      mockService.assignWorkspaceToNewWindow.mockResolvedValue('MyWorkspace');

      await (listener as any).handleNewWindow(5);

      expect(mockDebounceFn.cancel).toHaveBeenCalled();
      expect((listener as any).saveMap.has(5)).toBe(false);
      expect(mockService.restoreWorkspace).toHaveBeenCalledWith(
        5,
        'MyWorkspace'
      );
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Service error');
      mockService.assignWorkspaceToNewWindow.mockRejectedValue(error);

      await expect((listener as any).handleNewWindow(5)).rejects.toThrow(
        'Service error'
      );
    });
  });

  describe('handleEndWindow', () => {
    it('should clear active workspace for window', async () => {
      await (listener as any).handleEndWindow(7);

      expect(mockService.clearActiveWorkspaceForWindow).toHaveBeenCalledWith(7);
    });

    it('should handle multiple window removals', async () => {
      await (listener as any).handleEndWindow(7);
      await (listener as any).handleEndWindow(8);
      await (listener as any).handleEndWindow(9);

      expect(mockService.clearActiveWorkspaceForWindow).toHaveBeenCalledTimes(
        3
      );
      expect(mockService.clearActiveWorkspaceForWindow).toHaveBeenNthCalledWith(
        1,
        7
      );
      expect(mockService.clearActiveWorkspaceForWindow).toHaveBeenNthCalledWith(
        2,
        8
      );
      expect(mockService.clearActiveWorkspaceForWindow).toHaveBeenNthCalledWith(
        3,
        9
      );
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Clear error');
      mockService.clearActiveWorkspaceForWindow.mockRejectedValue(error);

      await expect((listener as any).handleEndWindow(7)).rejects.toThrow(
        'Clear error'
      );
    });
  });

  describe('window lifecycle integration', () => {
    it('should call handleNewWindow when new window is created', async () => {
      mockService.assignWorkspaceToNewWindow.mockResolvedValue('Workspace1');
      listener.installAutoSaveListeners();

      const onCreatedListener = (
        chrome.windows.onCreated.addListener as jest.Mock
      ).mock.calls[0][0];

      await onCreatedListener({ id: 20, type: 'normal' });

      expect(mockService.assignWorkspaceToNewWindow).toHaveBeenCalledWith(20);
      expect(mockService.restoreWorkspace).toHaveBeenCalledWith(
        20,
        'Workspace1'
      );
    });

    it('should not process non-normal window types', async () => {
      listener.installAutoSaveListeners();

      const onCreatedListener = (
        chrome.windows.onCreated.addListener as jest.Mock
      ).mock.calls[0][0];

      onCreatedListener({ id: 21, type: 'popup' });

      expect(mockService.assignWorkspaceToNewWindow).not.toHaveBeenCalled();
    });

    it('should call handleEndWindow when window is removed', async () => {
      listener.installAutoSaveListeners();

      const onRemovedListener = (
        chrome.windows.onRemoved.addListener as jest.Mock
      ).mock.calls[0][0];

      await onRemovedListener(22);

      expect(mockService.clearActiveWorkspaceForWindow).toHaveBeenCalledWith(
        22
      );
    });
  });
});
