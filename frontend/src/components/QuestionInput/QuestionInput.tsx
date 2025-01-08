import { useContext, useState, useCallback, forwardRef } from 'react';
import { FontIcon, Stack, TextField } from '@fluentui/react';
import { SendRegular, AttachRegular } from '@fluentui/react-icons';
import Uploady, { Destination, useItemStartListener, useItemFinishListener, useItemErrorListener } from '@rpldy/uploady';
import UploadDropZone from '@rpldy/upload-drop-zone';
import { asUploadButton } from '@rpldy/upload-button';

import Send from '../../assets/Send.svg';
import DocumentIcon from '../../assets/Document_Solutions_Duotone.svg';
import Spinner from '../common/Spinner';

import styles from './QuestionInput.module.css';
import { ChatMessage, indexDocument, indexStatus, frontendSettings, FrontendSettings } from '../../api';
import { AppStateContext } from '../../state/AppProvider';
import { resizeImage } from '../../utils/resizeImage';

interface Props {
    onSend: (question: ChatMessage['content'], id?: string) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    conversationId?: string;
    onConversationIdUpdate?: (newConversationId: string, filename: string) => void;
    onDocumentIndexing?: (isIndexing: boolean) => void;
    onDocumentUploading?: (isUploading: boolean) => void;
}

interface UploadSpinnerProps {
    documentUploaded: boolean;
    setDocumentUploaded: React.Dispatch<React.SetStateAction<boolean>>;
    onUploadStatusChange: (isUploading: boolean) => void;
    onUploadSuccess: (conversationId: string, indexId: string, fileName: string) => void;
}

const UploadSpinner: React.FC<UploadSpinnerProps> = ({
    documentUploaded,
    setDocumentUploaded,
    onUploadStatusChange,
    onUploadSuccess
}) => {
    const [uploading, setUploading] = useState(false);
    const [isSuccessfulUpload, setIsSuccessfulUpload] = useState(false);

    useItemStartListener(() => {
        onUploadStatusChange(true);
        setUploading(true);
        setIsSuccessfulUpload(false);
        setDocumentUploaded(false);
    });

    useItemErrorListener(() => {
        setIsSuccessfulUpload(false);
        setUploading(false);
    });

    useItemFinishListener(item => {
        if (item.uploadResponse && item.uploadStatus === 200) {
            if (item.uploadResponse.data.conversation_id) {
                onUploadStatusChange(false);

                onUploadSuccess(
                    item.uploadResponse.data.conversation_id,
                    item.uploadResponse.data.index_id,
                    item.uploadResponse.data.document_name
                );
            }
        }
        if (uploading) {
            setUploading(false);
        }
        if (isSuccessfulUpload !== (item.uploadStatus === 200)) {
            setIsSuccessfulUpload(item.uploadStatus === 200);
        }
    });

    return (
        <div className={styles.questionInputDocumentButtonContainer}>
            {uploading && <Spinner isActive={uploading} />}
            {(uploading || (isSuccessfulUpload && !documentUploaded)) && (
                <img src={DocumentIcon} className={styles.documentIcon} alt="Uploaded document" />
            )}
        </div>
    );
};

export const QuestionInput = ({
    onSend,
    disabled,
    placeholder,
    clearOnSend,
    conversationId,
    onConversationIdUpdate,
    onDocumentIndexing,
    onDocumentUploading
}: Props) => {
    const [question, setQuestion] = useState<string>('');
    const [base64Image, setBase64Image] = useState<string | null>(null);
    const [documentUploaded, setDocumentUploaded] = useState<boolean>(false);
    const [indexId, setIndexId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const appStateContext = useContext(AppStateContext);
    const OYD_ENABLED = appStateContext?.state.frontendSettings?.oyd_enabled || false;
    const DOCUPLOAD_MAX_SIZE_MB = appStateContext?.state.frontendSettings?.upload_max_filesize;

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            console.warn('No file selected');
            return;
        }
        try {
            const resizedBase64 = await resizeImage(file, 800, 800);
            setBase64Image(resizedBase64);
        } catch (error) {
            console.error('Error during image upload:', error);
        }
    };

    const onPaste = async (event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const clipboardItems = event.clipboardData.items;

        for (let i = 0; i < clipboardItems.length; i++) {
            const item = clipboardItems[i];
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    try {
                        const resizedBase64 = await resizeImage(file, 800, 800);
                        setBase64Image(resizedBase64);
                    } catch (error) {
                        console.error('Error during image paste:', error);
                    }
                }
                break; // Exit loop once an image is found
            }
        }
    };

    const removeImage = () => setBase64Image(null);

    const sendQuestion = useCallback(async () => {
        if (disabled || !question.trim()) {
            return;
        }

        const questionContent: ChatMessage['content'] = base64Image
            ? [
                { type: 'text', text: question },
                { type: 'image_url', image_url: { url: base64Image } },
            ]
            : question.toString();

        if (clearOnSend) {
            setQuestion('');
            setDocumentUploaded(true);
        }

        if (indexId && onDocumentIndexing) {
            onDocumentIndexing(true);

            const result = await indexDocument(indexId);
            const interval: number = ((await frontendSettings()) as FrontendSettings).polling_interval || 0;

            for (let i = 0; i < 100; i++) {
                await new Promise(f => setTimeout(f, interval * 1000));

                const status = await indexStatus(result);

                if (status === 'success' || status === 'transientFailure') break;
            }

            onDocumentIndexing(false);
            setIndexId('');
        }

        conversationId ? onSend(questionContent, conversationId) : onSend(questionContent);
        setBase64Image(null);
        setError('');
    }, [disabled, question, base64Image, clearOnSend, indexId, onDocumentIndexing, conversationId, onSend]);

    const handleUploadSuccess = useCallback(
        (newConversationId: string, uniqueId: string, filename: string) => {
            if (onConversationIdUpdate && newConversationId !== null) {
                onConversationIdUpdate(newConversationId, filename);
                setIndexId(uniqueId);
            }
        },
        [onConversationIdUpdate]
    );

    const handleUploadStatusChange = useCallback(
        (isUploading: boolean) => {
            if (onDocumentUploading) {
                onDocumentUploading(isUploading);
            }
        },
        [onDocumentUploading]
    );

    const onEnterPress = useCallback(
        (ev: React.KeyboardEvent<Element>) => {
            if (ev.key === 'Enter' && !ev.shiftKey && !(ev.nativeEvent?.isComposing === true)) {
                ev.preventDefault();
                sendQuestion();
            }
        },
        [sendQuestion]
    );

    const fileSizeOk = useCallback(async (file: any) => {
        setError('');
        if (DOCUPLOAD_MAX_SIZE_MB && file.size > DOCUPLOAD_MAX_SIZE_MB * 1024 * 1024) {
            setError('File size too large. Maximum file size is ' + DOCUPLOAD_MAX_SIZE_MB + 'MB.');
            return false;
        } else return true;
    }, []);

    const onQuestionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setQuestion(newValue || '');
    };

    const sendQuestionDisabled = disabled || !question.trim();

    const uploadDestination: Destination = {
        url: '/document/upload'
    };

    const UploadWidget = asUploadButton(
        forwardRef<HTMLDivElement>((props, ref) => (
            <div {...props} className={styles.uploadButton}>
                <div className={styles.questionUploadButtonContainer}>
                    <AttachRegular className={styles.questionUploadButton} />
                </div>
            </div>
        ))
    );

    const ImagePreview = () => (
        <div
            className={styles.uploadPreviewContainer}
            style={{
                position: 'relative',
                maxWidth: 'calc(100% - 120px)',
                marginRight: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <img
                className={styles.uploadedImage}
                src={base64Image || ''}
                alt="Uploaded Preview"
                style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }}
            />
            <button
                className={styles.removeImageButton}
                onClick={removeImage}
                aria-label="Remove Uploaded Image"
                style={{
                    position: 'absolute',
                    top: '5px',
                    right: '35px',
                    backgroundColor: 'rgba(255, 0, 0, 0.8)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: '1',
                }}
            >
                &times;
            </button>
        </div>
    );

    return (
        <Uploady destination={uploadDestination} fileFilter={fileSizeOk} params={{ conversationId: conversationId }}>
            <UploadDropZone onDragOverClassName="drag-over" grouped maxGroupSize={3}>
                <Stack horizontal className={styles.questionInputContainer}>
                    <TextField
                        className={styles.questionInputTextArea}
                        placeholder={placeholder}
                        multiline
                        resizable={false}
                        borderless
                        value={question}
                        onChange={onQuestionChange}
                        onKeyDown={onEnterPress}
                        onPaste={onPaste}
                    />

                    <Stack horizontal className={styles.questionInputActionsContainer}>
                        <UploadWidget />
                        {error && <span className={styles.error}>{error}</span>}
                        <UploadSpinner
                            documentUploaded={documentUploaded}
                            setDocumentUploaded={setDocumentUploaded}
                            onUploadSuccess={handleUploadSuccess}
                            onUploadStatusChange={handleUploadStatusChange}
                        />
                        <div
                            className={styles.questionInputSendButtonContainer}
                            role="button"
                            tabIndex={0}
                            aria-label="Ask question button"
                            onClick={sendQuestion}
                            onKeyDown={e => (e.key === 'Enter' || e.key === ' ' ? sendQuestion() : null)}>
                            {sendQuestionDisabled ? (
                                <SendRegular className={styles.questionInputSendButtonDisabled} />
                            ) : (
                                <img src={Send} className={styles.questionInputSendButton} alt="Send Button" />
                            )}
                        </div>
                    </Stack>
                </Stack>
            </UploadDropZone>
        </Uploady>
    );
};
