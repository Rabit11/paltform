package com.zgsf.srpm.org;

import com.zgsf.srpm.domain.PersonDirectory;
import com.zgsf.srpm.domain.SysUser;
import com.zgsf.srpm.domain.UnitEntity;
import com.zgsf.srpm.repo.PersonDirectoryRepository;
import com.zgsf.srpm.repo.SysUserRepository;
import com.zgsf.srpm.repo.UnitRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class OrgPeopleClientImpl implements OrgPeopleClient {
    private final boolean enabled;
    private final String baseUrl;
    private final String token;
    private final PersonDirectoryRepository people;
    private final SysUserRepository users;
    private final UnitRepository units;

    public OrgPeopleClientImpl(
            @Value("${srpm.org-platform.enabled:false}") boolean enabled,
            @Value("${srpm.org-platform.base-url:}") String baseUrl,
            @Value("${srpm.org-platform.token:}") String token,
            PersonDirectoryRepository people,
            SysUserRepository users,
            UnitRepository units) {
        this.enabled = enabled;
        this.baseUrl = baseUrl;
        this.token = token;
        this.people = people;
        this.users = users;
        this.units = units;
    }

    @Override
    public List<PersonDirectory> fetchAll() {
        if (!enabled || baseUrl == null || baseUrl.isBlank()) {
            return seedFromLocalUsers();
        }
        RestClient client = RestClient.builder().baseUrl(baseUrl).build();
        @SuppressWarnings("unchecked")
        Map<String, Object> body = client.get()
                .uri("/api/people")
                .header("Authorization", token.isBlank() ? "" : "Bearer " + token)
                .retrieve()
                .body(Map.class);
        List<PersonDirectory> out = new ArrayList<>();
        Object raw = body == null ? null : body.get("people");
        if (raw instanceof List<?> list) {
            for (Object o : list) {
                if (o instanceof Map<?, ?> rawMap) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> m = (Map<String, Object>) rawMap;
                    PersonDirectory p = new PersonDirectory();
                    Object emp = m.get("empNo");
                    if (emp == null) emp = m.get("emp_no");
                    p.setEmpNo(emp == null ? "" : String.valueOf(emp));
                    p.setName(String.valueOf(m.getOrDefault("name", "")));
                    p.setUnitCode(String.valueOf(m.getOrDefault("unitCode", "")));
                    p.setUnitName(String.valueOf(m.getOrDefault("unitName", "")));
                    p.setDeptName(String.valueOf(m.getOrDefault("deptName", "")));
                    p.setOnJob(!"false".equalsIgnoreCase(String.valueOf(m.getOrDefault("onJob", true))));
                    p.setSyncedAt(Instant.now());
                    if (p.getEmpNo() != null && !p.getEmpNo().isBlank()) out.add(p);
                }
            }
        }
        people.saveAll(out);
        return out;
    }

    private List<PersonDirectory> seedFromLocalUsers() {
        List<PersonDirectory> out = new ArrayList<>();
        for (SysUser u : users.findAll()) {
            PersonDirectory p = people.findById(u.getEmpNo()).orElseGet(PersonDirectory::new);
            p.setEmpNo(u.getEmpNo());
            p.setName(u.getName());
            UnitEntity unit = u.getUnitId() == null ? null : units.findById(u.getUnitId()).orElse(null);
            p.setUnitCode(unit == null ? "" : String.valueOf(unit.getId()));
            p.setUnitName(unit == null ? "" : unit.getName());
            p.setDeptName(u.getTitle());
            p.setOnJob("在岗".equals(u.getStatus()));
            p.setSyncedAt(Instant.now());
            out.add(p);
        }
        people.saveAll(out);
        return out;
    }
}
