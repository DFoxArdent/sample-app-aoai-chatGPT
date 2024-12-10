import { useContext, useEffect, useState } from 'react';
import { Dialog, Stack, TextField, Toggle } from '@fluentui/react';
import { CopyRegular } from '@fluentui/react-icons';
import { Outlet } from 'react-router-dom';

import { CosmosDBStatus } from '../../api';
import Contoso from '../../assets/Atlas AI Icon.svg';
import { HistoryButton, ShareButton } from '../../components/common/Button';
import { AppStateContext } from '../../state/AppProvider';

import styles from './Layout.module.css';

const Layout = () => {
    const [isSharePanelOpen, setIsSharePanelOpen] = useState<boolean>(false);
    const [copyClicked, setCopyClicked] = useState<boolean>(false);
    const [copyText, setCopyText] = useState<string>('Copy URL');
    const [shareLabel, setShareLabel] = useState<string | undefined>('Share');
    const [hideHistoryLabel, setHideHistoryLabel] = useState<string>('Hide chat history');
    const [showHistoryLabel, setShowHistoryLabel] = useState<string>('Show chat history');
    const [useCustomEnvironment, setUseCustomEnvironment] = useState(false);
    const appStateContext = useContext(AppStateContext);
    const ui = appStateContext?.state.frontendSettings?.ui;

    // Fetch the current environment state from the backend
    useEffect(() => {
        fetch('/api/get-env-mode', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        })
            .then((response) => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Failed to fetch environment mode');
            })
            .then((data) => setUseCustomEnvironment(data.isCustomMode || false))
            .catch(() => setUseCustomEnvironment(false));
    }, []);

    // Handler for toggling the environment mode
    const handleEnvironmentToggle = (checked: boolean) => {
        setUseCustomEnvironment(checked);

        fetch('/api/set-env-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isCustomMode: checked }),
        })
            .then((response) => {
                if (!response.ok) {
                    console.error('Failed to set environment mode:', response.statusText);
                    alert('Failed to update environment mode. Please try again.');
                } else {
                    console.log('Environment mode successfully updated.');
                }
            })
            .catch((error) => {
                console.error('Error updating environment mode:', error);
                alert('An error occurred while updating the environment mode.');
            });
    };

    // Handler for showing the share panel
    const handleShareClick = () => {
        setIsSharePanelOpen(true);
    };

    // Handler for dismissing the share panel
    const handleSharePanelDismiss = () => {
        setIsSharePanelOpen(false);
        setCopyClicked(false);
        setCopyText('Copy URL');
    };

    // Handler for copying the URL
    const handleCopyClick = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopyClicked(true);
    };

    // Handler for toggling chat history visibility
    const handleHistoryClick = () => {
        appStateContext?.dispatch({ type: 'TOGGLE_CHAT_HISTORY' });
    };

    // Update copy button text when clicked
    useEffect(() => {
        if (copyClicked) {
            setCopyText('Copied URL');
        }
    }, [copyClicked]);

    // Update labels for share and history buttons based on screen size
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 480) {
                setShareLabel(undefined);
                setHideHistoryLabel('Hide history');
                setShowHistoryLabel('Show history');
            } else {
                setShareLabel('Share');
                setHideHistoryLabel('Hide chat history');
                setShowHistoryLabel('Show chat history');
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className={styles.layout}>
            <header className={styles.header} role={'banner'}>
                <Stack horizontal verticalAlign="center" horizontalAlign="space-between" className={styles.headerContainer}>
                    <Stack horizontal verticalAlign="center">
                        <a href="https://ardentatlas.azurewebsites.net/Projects/ApplicationSection" title="Go to Ardent Atlas Projects">
                            <img
                                src={ui?.logo ? ui.logo : Contoso}
                                className={styles.headerIcon}
                                aria-hidden="true"
                                title="Click here to return to Atlas"
                                alt="Ardent AI Logo"
                            />
                        </a>
                    </Stack>
                    <Stack horizontal verticalAlign="center" className={styles.toggleContainer}>
                        <Toggle
                            label="Use Non-Ardent Knowledge Base"
                            checked={useCustomEnvironment}
                            onChange={(_, checked) => handleEnvironmentToggle(checked!)}
                            inlineLabel
                        />
                    </Stack>
                    <Stack horizontal tokens={{ childrenGap: 4 }} className={styles.shareButtonContainer}>
                        {appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured && (
                            <HistoryButton
                                onClick={handleHistoryClick}
                                text={appStateContext?.state?.isChatHistoryOpen ? hideHistoryLabel : showHistoryLabel}
                            />
                        )}
                        {ui?.show_share_button && <ShareButton onClick={handleShareClick} text={shareLabel} />}
                    </Stack>
                </Stack>
            </header>
            <Outlet />
            <Dialog
                onDismiss={handleSharePanelDismiss}
                hidden={!isSharePanelOpen}
                styles={{
                    main: [
                        {
                            selectors: {
                                ['@media (min-width: 480px)']: {
                                    maxWidth: '600px',
                                    background: '#FFFFFF',
                                    boxShadow: '0px 14px 28.8px rgba(0, 0, 0, 0.24), 0px 0px 8px rgba(0, 0, 0, 0.2)',
                                    borderRadius: '8px',
                                    maxHeight: '200px',
                                    minHeight: '100px',
                                },
                            },
                        },
                    ],
                }}
                dialogContentProps={{
                    title: 'Share the web app',
                    showCloseButton: true,
                }}>
                <Stack horizontal verticalAlign="center" style={{ gap: '8px' }}>
                    <TextField className={styles.urlTextBox} defaultValue={window.location.href} readOnly />
                    <div
                        className={styles.copyButtonContainer}
                        role="button"
                        tabIndex={0}
                        aria-label="Copy"
                        onClick={handleCopyClick}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? handleCopyClick() : null)}>
                        <CopyRegular className={styles.copyButton} />
                        <span className={styles.copyButtonText}>{copyText}</span>
                    </div>
                </Stack>
            </Dialog>
        </div>
    );
};

export default Layout;
