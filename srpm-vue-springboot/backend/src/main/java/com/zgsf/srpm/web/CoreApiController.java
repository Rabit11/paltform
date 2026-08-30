package com.zgsf.srpm.web;

import com.zgsf.srpm.domain.PersonDirectory;
import com.zgsf.srpm.domain.SysUser;
import com.zgsf.srpm.domain.UnitEntity;
import com.zgsf.srpm.org.OrgPeopleClient;
import com.zgsf.srpm.repo.PersonDirectoryRepository;
import com.zgsf.srpm.repo.ProjectRepository;
import com.zgsf.srpm.repo.SysUserRepository;
import com.zgsf.srpm.repo.UnitRepository;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class CoreApiController {
    private final UnitRepository units;
    private final PersonDirectoryRepository people;
    private final SysUserRepository users;
    private final ProjectRepository projects;
    private final OrgPeopleClient orgPeople;

    public CoreApiController(UnitRepository units, PersonDirectoryRepository people, SysUserRepository users,
                             ProjectRepository projects, OrgPeopleClient orgPeople) {
        this.units = units;
        this.people = people;
        this.users = users;
        this.projects = projects;
        this.orgPeople = orgPeople;
    }

    @GetMapping("/bootstrap")
    public Map<String, Object> bootstrap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("units", units.findAll());
        m.put("channels", List.of());
        m.put("today", java.time.LocalDate.now().toString());
        return m;
    }

    @GetMapping("/roster")
    public Map<String, Object> roster() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("people", people.findByOnJobTrueOrderByEmpNoAsc().stream().map(this::mapPerson).toList());
        return m;
    }

    @GetMapping("/meta/people")
    public Map<String, Object> metaPeople(Authentication auth) {
        SysUser me = (SysUser) auth.getPrincipal();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("me", me.getName());
        m.put("people", people.findByOnJobTrueOrderByEmpNoAsc().stream().map(this::mapPerson).toList());
        return m;
    }

    @PostMapping("/org/people/sync")
    public Map<String, Object> syncPeople(Authentication auth) {
        SysUser me = (SysUser) auth.getPrincipal();
        if (!"admin".equals(me.getRole()) && !"mgmt".equals(me.getRole())) {
            return Map.of("error", "无权同步人员");
        }
        List<PersonDirectory> list = orgPeople.fetchAll();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ok", true);
        m.put("count", list.size());
        return m;
    }

    @GetMapping("/projects")
    public List<Map<String, Object>> projectList(Authentication auth) {
        SysUser me = (SysUser) auth.getPrincipal();
        return projects.findAll().stream()
                .filter(p -> visible(me, p.getLeadUnitId()))
                .map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", p.getId());
                    m.put("code", p.getCode());
                    m.put("name", p.getName());
                    m.put("status", p.getStatus());
                    m.put("level", p.getLevel());
                    m.put("total_budget", p.getTotalBudget());
                    return m;
                })
                .toList();
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(Authentication auth) {
        SysUser me = (SysUser) auth.getPrincipal();
        long total = projects.findAll().stream().filter(p -> visible(me, p.getLeadUnitId())).count();
        Map<String, Object> kpis = new LinkedHashMap<>();
        kpis.put("total", total);
        kpis.put("source", "spring-boot");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kpis", kpis);
        return out;
    }

    @GetMapping("/admin/users")
    public Map<String, Object> adminUsers(Authentication auth) {
        SysUser me = (SysUser) auth.getPrincipal();
        if (!"admin".equals(me.getRole())) {
            return Map.of("error", "仅系统管理员");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("users", users.findAll().stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("emp_no", u.getEmpNo());
            m.put("name", u.getName());
            m.put("role", u.getRole());
            m.put("scope", u.getScope());
            m.put("unit_id", u.getUnitId());
            m.put("title", u.getTitle());
            m.put("form_access", u.getFormAccess());
            m.put("form_scope", u.getFormScope());
            m.put("status", u.getStatus());
            return m;
        }).toList());
        return out;
    }

    private boolean visible(SysUser me, Long leadUnitId) {
        if ("admin".equals(me.getRole()) || "leader".equals(me.getRole())) return true;
        if ("mgmt".equals(me.getRole()) && "hq".equals(me.getScope())) return true;
        if (me.getUnitId() == null || leadUnitId == null) return true;
        return me.getUnitId().equals(leadUnitId);
    }

    private Map<String, Object> mapPerson(PersonDirectory p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("empNo", p.getEmpNo());
        m.put("emp_no", p.getEmpNo());
        m.put("name", p.getName());
        m.put("unitName", p.getUnitName());
        m.put("dept", p.getDeptName());
        m.put("label", p.getName() + "（" + p.getEmpNo() + "）");
        m.put("onJob", p.isOnJob());
        return m;
    }
}
