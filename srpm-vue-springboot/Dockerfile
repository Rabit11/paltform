FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY backend/pom.xml /src/pom.xml
COPY backend/src /src/src
COPY frontend/dist /src/src/main/resources/static
RUN mkdir -p /root/.m2 && printf '<settings><mirrors><mirror><id>aliyun</id><mirrorOf>*</mirrorOf><url>https://maven.aliyun.com/repository/public</url></mirror></mirrors></settings>' > /root/.m2/settings.xml \
 && mvn -q -DskipTests package

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
RUN mkdir -p /data
COPY --from=build /src/target/*.jar /app/app.jar
ENV SPRING_DATASOURCE_URL=jdbc:h2:file:/data/srpm;MODE=MySQL;AUTO_SERVER=TRUE \
    SERVER_PORT=8080
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
