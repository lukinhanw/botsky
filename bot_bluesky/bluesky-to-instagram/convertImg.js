const axios = require('axios');
const sharp = require('sharp');

// Função para baixar a imagem a partir de uma URL
async function downloadImage(url) {
    try {
        const response = await axios({
            url,
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        if (response.status !== 200) {
            throw new Error(`Falha ao baixar a imagem. Código de status: ${response.status}`);
        }

        const contentType = response.headers['content-type'];
        if (!contentType.startsWith('image/')) {
            throw new Error(`O URL não aponta para uma imagem. Content-Type: ${contentType}`);
        }

        return Buffer.from(response.data);
    } catch (error) {
        throw new Error(`Erro ao baixar a imagem ${url}: ${error.message}`);
    }
}

// Função para combinar duas imagens lado a lado
async function combineImages(imageUrl1, imageUrl2) {
    try {
        // Baixar as imagens
        const imageBuffer1 = await downloadImage(imageUrl1);
        const imageBuffer2 = await downloadImage(imageUrl2);

        // Redimensionar as imagens sem alterar o formato original
        const resizedImage1 = await sharp(imageBuffer1)
            .resize(600, 400)
            .toBuffer();
        const resizedImage2 = await sharp(imageBuffer2)
            .resize(600, 400)
            .toBuffer();

        // Combinar as imagens
        const combinedImage = await sharp({
            create: {
                width: 1200,
                height: 400,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            }
        })
            .composite([
                { input: resizedImage1, top: 0, left: 0 },
                { input: resizedImage2, top: 0, left: 600 }
            ])
            .png() // Especifica o formato de saída
            .toFile('combined-image.png');

    } catch (error) {
        console.error('Erro ao combinar imagens:', error.message);
    }
}

module.exports = { combineImages };