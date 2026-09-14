# Usar la imagen oficial de Node.js
FROM node:18-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el resto del código del servidor
COPY . .

# Exponer el puerto predeterminado
EXPOSE 8080

# Comando para iniciar la aplicación
CMD ["npm", "start"]