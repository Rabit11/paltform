FROM maven:3.9.9-eclipse-temurin-17-alpine AS build
WORKDIR /src
COPY docker/settings.xml /root/.m2/settings.xml
COPY pom.xml .
RUN mvn -q -B -DskipTests dependency:go-offline || true
COPY src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN mkdir -p /data
COPY --from=build /src/target/*.jar /app/app.jar
EXPOSE 8080
ENV SPRING_DATASOURCE_URL=jdbc:h2:file:/data/srpm;MODE=MySQL
ENTRYPOINT ["java","-jar","/app/app.jar"]
