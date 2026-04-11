document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewArea = document.getElementById('previewArea');
    const form = document.getElementById('uploadForm');
    const sendButton = document.getElementById('sendButton');
    const closeButton = document.getElementById('closeButton');
    const addMoreButton = document.getElementById('addMoreButton');
    const uploadStatus = document.getElementById('uploadStatus');
    const senderNameInput = document.getElementById('senderName');

    let files = [];
    const urlParams = new URLSearchParams(window.location.search);
    const cafeId = urlParams.get('cafeId');

    // Event listeners setup
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#25D366';
        dropZone.style.backgroundColor = '#f0f9f0';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#e0e0e0';
        dropZone.style.backgroundColor = 'transparent';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#e0e0e0';
        dropZone.style.backgroundColor = 'transparent';
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    addMoreButton.addEventListener('click', () => fileInput.click());

    function handleFiles(newFiles) {
        files = [...files, ...Array.from(newFiles)];
        updatePreview();
    }

    function updatePreview() {
        previewArea.innerHTML = '';
        files.forEach((file, index) => {
            const filePreview = createFilePreviewElement(file, index);
            previewArea.appendChild(filePreview);
        });
    }

    function createFilePreviewElement(file, index) {
        const filePreview = document.createElement('div');
        filePreview.className = 'file-preview';
        filePreview.style.cssText = `
            display: flex;
            align-items: center;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 8px;
            animation: fadeIn 0.3s ease;
        `;

        filePreview.innerHTML = `
            <div class="file-icon">
                <svg style="width: 24px; height: 24px; color: #666;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
            </div>
            <div class="file-info" style="margin-left: 12px; flex: 1;">
                <div style="font-size: 14px; color: #1a1a1a;">${file.name}</div>
                <div style="font-size: 12px; color: #666;">${(file.size / 1024).toFixed(1)} KB</div>
            </div>
            <button class="remove-button" style="background: none; border: none; font-size: 20px; color: #666; cursor: pointer;">×</button>
        `;

        const removeButton = filePreview.querySelector('.remove-button');
        removeButton.addEventListener('click', () => {
            files.splice(index, 1);
            updatePreview();
        });

        return filePreview;
    }

    async function handleFileUpload(files, cafeId, senderName) {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });
        formData.append('cafeId', cafeId);
        formData.append('senderName', senderName);

        const response = await fetch('/upload/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Upload failed');
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Upload failed');
        }

        return result.files;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (files.length === 0 || !senderNameInput.value.trim()) {
            showStatus('Please enter sender name and select at least one file to upload.', 'error');
            return;
        }

        sendButton.disabled = true;
        sendButton.style.opacity = '0.7';

        try {
            const uploadedFiles = await handleFileUpload(files, cafeId, senderNameInput.value.trim());
            showStatus('Files uploaded successfully!', 'success');
            console.log('Files uploaded:', uploadedFiles);
            
            // Reset form
            files = [];
            updatePreview();
            senderNameInput.value = '';
        } catch (error) {
            showStatus(`Upload failed: ${error.message}`, 'error');
            console.error('Upload failed:', error);
        } finally {
            sendButton.disabled = false;
            sendButton.style.opacity = '1';
        }
    });

    function showStatus(message, type) {
        uploadStatus.textContent = message;
        uploadStatus.style.color = type === 'error' ? '#dc3545' : 
                                 type === 'success' ? '#28a745' : '#0056b3';
        uploadStatus.style.display = 'block';
        setTimeout(() => {
            uploadStatus.style.display = 'none';
        }, 5000);
    }

    closeButton.addEventListener('click', () => {
        // Add your close logic here
        console.log('Close button clicked');
    });
});
