import { useContext, useState } from 'react';
import { FontIcon, Stack, TextField } from '@fluentui/react';
import { SendRegular } from '@fluentui/react-icons';

import Send from '../../assets/Send.svg';

import styles from './QuestionInput.module.css';
import { ChatMessage } from '../../api';
import { AppStateContext } from '../../state/AppProvider';
import { resizeImage } from '../../utils/resizeImage';

interface Props {
    onSend: (question: ChatMessage['content'], id?: string) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    conversationId?: string;
}

export const QuestionInput = ({ onSend, disabled, placeholder, clearOnSend, conversationId }: Props) => {
    const [question, setQuestion] = useState<string>('');
    const [base64Image, setBase64Image] = useState<string | null>(null);

    const appStateContext = useContext(AppStateContext);
    const OYD_ENABLED = appStateContext?.state.frontendSettings?.oyd_enabled || false;

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

    const sendQuestion = () => {
        if (disabled || !question.trim()) return;

        const questionContent: ChatMessage['content'] = base64Image
            ? [
                { type: 'text', text: question },
                { type: 'image_url', image_url: { url: base64Image } },
            ]
            : question.toString();

        if (conversationId) {
            onSend(questionContent, conversationId);
        } else {
            onSend(questionContent);
        }

        setBase64Image(null);
        if (clearOnSend) setQuestion('');
    };

    const onEnterPress = (event: React.KeyboardEvent<Element>) => {
        if (event.key === 'Enter' && !event.shiftKey && !(event.nativeEvent?.isComposing === true)) {
            event.preventDefault();
            sendQuestion();
        }
    };

    const onQuestionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setQuestion(newValue || '');
    };

    const sendQuestionDisabled = disabled || !question.trim();

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
                    right: '35px', /* Adjusted position to move the button further left */
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
            {!OYD_ENABLED && (
                <div className={styles.fileInputContainer}>
                    <input
                        type="file"
                        id="fileInput"
                        onChange={handleImageUpload}
                        accept="image/*"
                        className={styles.fileInput}
                    />
                    <label htmlFor="fileInput" className={styles.fileLabel} aria-label="Upload Image">
                        <FontIcon
                            className={styles.fileIcon}
                            iconName="PhotoCollection"
                            aria-label="Upload Image Icon"
                        />
                    </label>
                </div>
            )}
            {base64Image && <ImagePreview />}
            <div
                className={styles.questionInputSendButtonContainer}
                role="button"
                tabIndex={0}
                aria-label="Ask Question Button"
                onClick={sendQuestion}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? sendQuestion() : null)}
            >
                {sendQuestionDisabled ? (
                    <SendRegular className={styles.questionInputSendButtonDisabled} />
                ) : (
                    <img src={Send} className={styles.questionInputSendButton} alt="Send Button" />
                )}
            </div>
            <div className={styles.questionInputBottomBorder} />
        </Stack>
    );
};
