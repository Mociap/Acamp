// Configurações da API do Google
const CLIENT_ID = '410920360157-oo2spte1sfd3f6m6e6shh5gmehf17i6d.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAOT4Iny33qwTqH7DKx_Sw1YX-rq1YViC0';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

// Pasta de fotos e vídeos (IDs das pastas do Google Drive)
const PHOTOS_FOLDER_ID = '1FETWLPjcWvbja399X70UFusPf3ctuoJm';
const VIDEOS_FOLDER_ID = '12Rfj4u1NB2Wv2Yldrk7EDsOyFafHXePk';

// Inicializar a API do Google
function initGoogleDriveAPI() {
    gapi.load('client:auth2', initClient);
}

// Inicializar o cliente da API
function initClient() {
    gapi.client.init({
        apiKey: 'AIzaSyAOT4Iny33qwTqH7DKx_Sw1YX',
        clientId: 'AIzaSyAOT4Iny33qwTqH7DKx_Sw1YX',
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(() => {
        // Verificar se o usuário está autenticado
        if (!gapi.auth2.getAuthInstance().isSignedIn.get()) {
            // Se não estiver autenticado, mostrar botão de login
            document.getElementById('authorize-button').style.display = 'block';
        } else {
            // Se estiver autenticado, carregar arquivos
            loadDriveFiles();
        }

        // Adicionar listener para mudanças no estado de autenticação
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        
        // Configurar botão de login
        document.getElementById('authorize-button').onclick = handleAuthClick;
    }).catch(error => {
        console.error('Erro ao inicializar cliente da API:', error);
                showError('Não foi possível conectar à API do Google Drive. Tente novamente mais tarde.');
    });
}

// Atualizar interface com base no status de autenticação
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        document.getElementById('authorize-button').style.display = 'none';
        document.getElementById('signout-button').style.display = 'block';
        loadDriveFiles();
    } else {
        document.getElementById('authorize-button').style.display = 'block';
        document.getElementById('signout-button').style.display = 'none';
    }
}

// Manipular clique no botão de login
function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn();
}

// Manipular clique no botão de logout
function handleSignoutClick() {
    gapi.auth2.getAuthInstance().signOut();
}

// Carregar arquivos do Google Drive
async function loadDriveFiles() {
    try {
        showLoading(true);
        
        // Limpar dados existentes
        mediaData.length = 0;
        albumsData.length = 0;
        
        // Carregar estrutura de álbuns
        await loadAlbumStructure();
        
        // Carregar fotos
        await loadPhotosFromDrive();
        
        // Carregar vídeos
        await loadVideosFromDrive();
        
        // Renderizar a galeria
        renderGallery();
        
        showLoading(false);
    } catch (error) {
        console.error('Erro ao carregar arquivos do Drive:', error);
        showError('Ocorreu um erro ao carregar os arquivos. Tente novamente mais tarde.');
        showLoading(false);
    }
}

// Carregar estrutura de álbuns
async function loadAlbumStructure() {
    // Verificar se há subpastas na pasta de fotos (cada subpasta será um álbum)
    const response = await gapi.client.drive.files.list({
        q: `'${PHOTOS_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name)',
        orderBy: 'name'
    });
    
    const folders = response.result.files;
    
    // Se não houver subpastas, criar um álbum geral
    if (folders.length === 0) {
        albumsData.push({
            id: 'all',
            title: 'Todas as Fotos',
            cover: '',  // Será atualizado com a primeira foto
            count: 0,
            tags: ['all']
        });
    } else {
        // Criar álbuns para cada subpasta
        for (const folder of folders) {
            albumsData.push({
                id: folder.id,
                title: folder.name,
                cover: '',  // Será atualizado com a primeira foto de cada pasta
                count: 0,
                tags: [folder.name.toLowerCase().replace(/\s+/g, '')]
            });
        }
    }
}

// Carregar fotos do Google Drive
async function loadPhotosFromDrive() {
    // Buscar todas as imagens na pasta principal e subpastas
    const response = await gapi.client.drive.files.list({
        q: `'${PHOTOS_FOLDER_ID}' in parents or parents in (select id from files where '${PHOTOS_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder') and (mimeType contains 'image/')`,
        fields: 'files(id, name, mimeType, thumbnailLink, parents, createdTime)',
        orderBy: 'createdTime desc',
        pageSize: 1000
    });
    
    const files = response.result.files;
    
    // Processar cada arquivo de imagem
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Determinar a qual álbum pertence
        let albumId = 'all';
        if (file.parents && file.parents[0] !== PHOTOS_FOLDER_ID) {
            albumId = file.parents[0];
        }
        
        // Encontrar o álbum correspondente
        const album = albumsData.find(a => a.id === albumId);
        if (album) {
            album.count++;
            
            // Se for a primeira foto do álbum, usar como capa
            if (!album.cover) {
                album.cover = `https://drive.google.com/uc?export=view&id=${file.id}`;
            }
        }
        
        // Extrair tags do nome do arquivo ou pasta
        const tags = [];
        if (album && album.tags) {
            tags.push(...album.tags);
        }
        
        // Adicionar tags baseadas no nome do arquivo
        const fileName = file.name.toLowerCase();
        if (fileName.includes('dia1') || fileName.includes('dia 1')) tags.push('dia1');
        if (fileName.includes('dia2') || fileName.includes('dia 2')) tags.push('dia2');
        if (fileName.includes('dia3') || fileName.includes('dia 3')) tags.push('dia3');
        if (fileName.includes('louvor')) tags.push('louvor');
        if (fileName.includes('gincana')) tags.push('gincana');
        if (fileName.includes('devocional')) tags.push('devocional');
        
        // Adicionar à lista de mídia
        mediaData.push({
            id: file.id,
            type: 'photo',
            url: `https://drive.google.com/uc?export=view&id=${file.id}`,
            thumbnail: file.thumbnailLink || `https://drive.google.com/thumbnail?id=${file.id}`,
            title: file.name.replace(/\.[^/.]+$/, ""), // Remove a extensão do arquivo
            description: `Foto do ACAMP IEBI 2025`,
            date: new Date(file.createdTime),
            likes: Math.floor(Math.random() * 50), // Simulação
            comments: Math.floor(Math.random() * 10), // Simulação
            albumId: albumId,
            tags: tags
        });
    }
}

// Carregar vídeos do Google Drive
async function loadVideosFromDrive() {
    // Buscar todos os vídeos na pasta de vídeos
    const response = await gapi.client.drive.files.list({
        q: `'${VIDEOS_FOLDER_ID}' in parents and (mimeType contains 'video/')`,
        fields: 'files(id, name, mimeType, thumbnailLink, createdTime)',
        orderBy: 'createdTime desc',
        pageSize: 100
    });
    
    const files = response.result.files;
    
    // Processar cada arquivo de vídeo
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Extrair tags do nome do arquivo
        const tags = ['video'];
        const fileName = file.name.toLowerCase();
        if (fileName.includes('dia1') || fileName.includes('dia 1')) tags.push('dia1');
        if (fileName.includes('dia2') || fileName.includes('dia 2')) tags.push('dia2');
        if (fileName.includes('dia3') || fileName.includes('dia 3')) tags.push('dia3');
        if (fileName.includes('louvor')) tags.push('louvor');
        if (fileName.includes('gincana')) tags.push('gincana');
        if (fileName.includes('devocional')) tags.push('devocional');
        
        // Adicionar à lista de mídia
        mediaData.push({
            id: file.id,
            type: 'video',
            url: `https://drive.google.com/file/d/${file.id}/preview`,
            downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
            thumbnail: file.thumbnailLink || `https://drive.google.com/thumbnail?id=${file.id}`,
            title: file.name.replace(/\.[^/.]+$/, ""), // Remove a extensão do arquivo
            description: `Vídeo do ACAMP IEBI 2025`,
            date: new Date(file.createdTime),
            likes: Math.floor(Math.random() * 30), // Simulação
            comments: Math.floor(Math.random() * 15), // Simulação
            albumId: 'videos',
            tags: tags
        });
    }
    
    // Adicionar álbum de vídeos se houver vídeos
    if (files.length > 0) {
        albumsData.push({
            id: 'videos',
            title: 'Vídeos do Acampamento',
            cover: files[0].thumbnailLink || `https://drive.google.com/thumbnail?id=${files[0].id}`,
            count: files.length,
            tags: ['video']
        });
    }
}

// Exibir/ocultar indicador de carregamento
function showLoading(show) {
    const loadingElement = document.getElementById('loading-spinner');
    if (loadingElement) {
        loadingElement.style.display = show ? 'flex' : 'none';
    }
}

// Exibir mensagem de erro
function showError(message) {
    const galleryContent = document.getElementById('galleryContent');
    galleryContent.innerHTML = `
        <div class="alert alert-danger" role="alert">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            ${message}
        </div>
    `;
}