# Imagens do catálogo

O hero e as onze fotografias de produto foram gerados com o recurso de geração de imagens da OpenAI para este projeto. São **imagens ilustrativas**, não fotografias da Lurdes, dos colaboradores ou dos produtos entregues. Não há fotografias de pessoas identificáveis. Os nomes, preços, alergénios e prazos vêm da API; as imagens apenas acompanham os onze produtos do seed original.

Todos os ficheiros estão em WebP. O hero mede 900 × 900 px (63 KB) e cada produto mede 640 × 480 px (25–48 KB). As imagens têm fundo creme claro, luz suave e enquadramento consistente. Não foram gerados texto, marcas ou avaliações.

| Ficheiro | Produto original |
| --- | --- |
| `public/images/hero.webp` | Mãos com saco de pasteleiro a decorar bolo de chocolate |
| `public/images/products/chocolate.webp` | Bolo de aniversário personalizado (chocolate) |
| `public/images/products/morango.webp` | Bolo de aniversário personalizado (morango) |
| `public/images/products/noz.webp` | Bolo de aniversário personalizado (noz) |
| `public/images/products/bolacha.webp` | Bolo de bolacha |
| `public/images/products/pao-lo.webp` | Pão de ló |
| `public/images/products/amendoa.webp` | Tarte de amêndoa |
| `public/images/products/rissois.webp` | Rissóis de camarão (cento) |
| `public/images/products/croquetes.webp` | Croquetes de carne (cento) |
| `public/images/products/quiches.webp` | Mini-quiches (dúzia) |
| `public/images/products/brigadeiros.webp` | Brigadeiros (dúzia) |
| `public/images/products/natas.webp` | Pastéis de nata (meia dúzia) |

Prompt do hero: fotografia editorial natural, mãos e avental branco a decorar com creme um bolo de chocolate acabado numa bancada clara; sem rosto, cabeça, texto, logo ou marca. Prompt dos produtos: fotografia de catálogo realista de cada produto nomeado, inteiro no enquadramento, ângulo de três quartos, prato branco, fundo creme claro, luz natural lateral suave; sem pessoas, texto, marca ou objetos extra. As imagens foram redimensionadas e convertidas localmente para WebP.

As capturas `hero-*.png` e `catalogo-*.png` são da aplicação local em 1366 × 900 e 390 × 844. O endpoint de produtos respondeu normalmente. Para mostrar somente os onze produtos originais, o script externo de captura filtrou da resposta de apresentação a fixture de teste `capacity test` que também estava na base local; não alterou o produto nem a API. O mapeamento no frontend deixa produtos desconhecidos com um ícone de fallback.
