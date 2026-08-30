package com.zgsf.srpm.web;

import com.zgsf.srpm.domain.SysUser;
import com.zgsf.srpm.domain.UnitEntity;
import com.zgsf.srpm.repo.SysUserRepository;
import com.zgsf.srpm.repo.UnitRepository;
import com.zgsf.srpm.security.JwtService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {
    private final SysUserRepository users;
    private final UnitRepository units;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthController(SysUserRepository users, UnitRepository units, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.units = units;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    public record LoginReq(@NotBlank String username, @NotBlank String password) {}

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginReq req) {
        SysUser u = users.findByEmpNo(req.username().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "工号或密码错误"));
        if (!"在岗".equals(u.getStatus()) || !encoder.matches(req.password(), u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "工号或密码错误");
        }
        Map<String, Object> body = publicUser(u);
        body.put("sessionToken", jwt.issue(u.getEmpNo(), u.getRole()));
        return body;
    }

    @GetMapping("/session")
    public Map<String, Object> session(Authentication auth) {
        SysUser u = (SysUser) auth.getPrincipal();
        return publicUser(u);
    }

    @PostMapping("/logout")
    public Map<String, Object> logout() {
        return Map.of("ok", true);
    }

    @GetMapping("/healthz")
    public Map<String, Object> health() {
        return Map.of("status", "ok", "service", "srpm", "stack", "spring-boot");
    }

    private Map<String, Object> publicUser(SysUser u) {
        boolean canForm = "admin".equals(u.getRole()) || u.getFormAccess() == 1;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("emp_no", u.getEmpNo());
        m.put("empNo", u.getEmpNo());
        m.put("name", u.getName());
        m.put("role", u.getRole());
        m.put("scope", u.getScope());
        m.put("unit_id", u.getUnitId());
        m.put("title", u.getTitle());
        m.put("status", u.getStatus());
        m.put("form_access", canForm ? 1 : 0);
        m.put("form_scope", canForm ? (u.getFormScope() == null ? "hq" : u.getFormScope()) : null);
        m.put("canFormMaintain", canForm);
        UnitEntity unit = u.getUnitId() == null ? null : units.findById(u.getUnitId()).orElse(null);
        m.put("unitName", unit == null ? null : unit.getName());
        return m;
    }
}
