# 科研项目信息化管理平台（目标栈）

前端：Vue3 + Vite + TypeScript + Ant Design Vue  
后端：Java 17 + Spring Boot 3  
人员：`person_directory` 与登录账号 `sys_user` 分离，可对接原平台人员接口。

现网 Node（18095）不在本目录替换，请并行运行直至切流。

## 启动

后端（需 JDK 17、Maven）：

```
cd backend
mvn spring-boot:run
```

前端：

```
cd frontend
npm install
npm run dev
```

浏览器 http://127.0.0.1:5173  
账号 `100001` / `100001`

对接原平台人员：在 `application.yml` 设置 `srpm.org-platform.enabled=true` 与 `base-url`，接口约定 `GET {base-url}/api/people` 返回 `{ people: [{ empNo, name, unitCode, unitName, deptName, onJob }] }`。
