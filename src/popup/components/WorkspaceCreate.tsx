import { useCallback, useEffect, useRef, useState } from 'preact/compat';
import debounce from 'lodash/debounce';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createWorkspace } from '@src/workspaceAPI/create';

interface WorkspaceCreateProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const defaultWorkspaceLogo = 'fi fi-rr-home';
const notFoundWorkspaceLogo = 'fi fi-rr-question';

export const WorkspaceCreate = ({
  isVisible,
  onClose,
  onSuccess,
}: WorkspaceCreateProps) => {
  const queryClient = useQueryClient();

  const [createWorkspaceLogo, setCreateWorkspaceLogo] =
    useState(defaultWorkspaceLogo);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoImgRef = useRef<HTMLElement>(null);

  const workspaceMutationAdd = useMutation({
    mutationFn: ({ name, logo }: { name: string; logo: string }) =>
      createWorkspace(name, logo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setCreateWorkspaceLogo(defaultWorkspaceLogo);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      onSuccess?.();
    },
  });

  const updateLogo = useCallback(() => {
    if (!logoInputRef.current || !logoImgRef.current) return;

    // Get text from input
    const inputedValue = logoInputRef.current.value.trim();

    // If empty, set to default logo
    if (inputedValue === '') {
      setCreateWorkspaceLogo(defaultWorkspaceLogo);
      return;
    }

    // Search for tag pattern "fi fi-rr-<icon-name>"
    const tagMatch = inputedValue.match(/fi fi-rr-([\w-]+)/);

    if (!tagMatch) {
      // If not found, set to not found logo
      setCreateWorkspaceLogo(notFoundWorkspaceLogo);
      return;
    }

    // Set the logo to the matched tag
    setCreateWorkspaceLogo(tagMatch[0]);

    // Small delay to ensure the icon updates correctly
    setTimeout(() => {}, 50);

    const logoOutput = window
      .getComputedStyle(logoImgRef.current!, 'before')
      .getPropertyValue('content');

    // If there is no ::before content, the logo is not found
    if (logoOutput === 'none') {
      setCreateWorkspaceLogo(notFoundWorkspaceLogo);
      return;
    }

    // Logo is valid at this point
  }, [logoInputRef, logoImgRef]);

  useEffect(() => {
    if (!logoInputRef.current || !logoImgRef.current) return;

    const logoInput = logoInputRef.current;
    const debouncedUpdateLogo = debounce(updateLogo, 300);

    logoInput.addEventListener('input', debouncedUpdateLogo);
    return () => {
      logoInput.removeEventListener('input', debouncedUpdateLogo);
    };
  }, [updateLogo]);

  const handleCreateWorkspace = (event: JSX.TargetedEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const icon = createWorkspaceLogo;
    console.log('Creating workspace:', { name, icon });
    workspaceMutationAdd.mutate({ name, logo: icon });
    onClose();
  };

  return (
    <section
      id='workspace-create'
      style={{
        display: isVisible ? 'block' : 'none',
      }}
    >
      <hr style={{ marginTop: '12px', marginBottom: '6px' }} />
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
        onSubmit={handleCreateWorkspace}
      >
        <input type='text' placeholder='Workspace Name' name='name' required />
        <div>
          <input
            type='text'
            style={{ marginRight: '5px' }}
            placeholder='Workspace Icon'
            name='icon'
            ref={logoInputRef}
          />
          <i
            className={createWorkspaceLogo}
            style={{ fontSize: '16px' }}
            ref={logoImgRef}
          />
        </div>
        <button type='submit'>Create</button>
      </form>
    </section>
  );
};
