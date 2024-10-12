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
        // Função para baixar a imagem
        async function downloadImage(url) {
            const response = await axios({
                url,
                responseType: 'arraybuffer'
            });
            return Buffer.from(response.data, 'binary');
        }

        // Baixar as imagens
        const imageBuffer1 = await downloadImage(imageUrl1);
        const imageBuffer2 = await downloadImage(imageUrl2);

        // Função para redimensionar a imagem mantendo a proporção e adicionando bordas brancas
        async function resizeAndPad(imageBuffer, size) {
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();
            const aspectRatio = metadata.width / metadata.height;

            let width, height;
            if (aspectRatio > 1) {
                // Imagem mais larga do que alta
                width = size;
                height = Math.round(size / aspectRatio);
            } else {
                // Imagem mais alta ou quadrada
                width = Math.round(size * aspectRatio);
                height = size;
            }

            // Redimensiona e adiciona bordas brancas para manter o formato quadrado
            return image
                .resize(width, height)
                .extend({
                    top: Math.floor((size - height) / 2),
                    bottom: Math.ceil((size - height) / 2),
                    left: Math.floor((size - width) / 2),
                    right: Math.ceil((size - width) / 2),
                    background: { r: 255, g: 255, b: 255, alpha: 1 } // Borda branca
                })
                .toBuffer();
        }

        // Redimensionar e adicionar bordas para as imagens (quadrado de 800x800)
        const resizedImage1 = await resizeAndPad(imageBuffer1, 800);
        const resizedImage2 = await resizeAndPad(imageBuffer2, 800);

        // Combinar as imagens uma embaixo da outra (800x1600 no total)
        await sharp({
            create: {
                width: 800,
                height: 1600, // Altura total (2x 800px)
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 } // Fundo branco
            }
        })
            .composite([
                { input: resizedImage1, top: 0, left: 0 },
                { input: resizedImage2, top: 800, left: 0 } // Segunda imagem começa a partir de 800px de altura
            ])
            .png() // Especifica o formato de saída
            .toFile('combined-image.png');

        console.log('Imagem combinada criada com sucesso: combined-image.png');

    } catch (error) {
        console.error('Erro ao combinar imagens:', error.message);
    }
}

module.exports = { combineImages };